// IndexedDB 저장(DB "pyrpg", store "saves", key "slot1"). 실패는 모두 SaveStoreError로 바꿔 던진다.
// idb 접근은 SaveBackend 하나로 좁혀 두고, 나머지 로직은 메모리 백엔드로 단위 테스트한다.
import { openDB, type IDBPDatabase } from "idb";
import type { SaveData } from "../contracts/state";
import { parseSave, SaveImportError } from "./exportImport";

export const DB_NAME = "pyrpg";
export const STORE_NAME = "saves";
export const SLOT_KEY = "slot1";

export type SaveStoreErrorCode = "unavailable" | "read" | "write" | "quota" | "corrupt";

export class SaveStoreError extends Error {
  readonly code: SaveStoreErrorCode;
  /** corrupt일 때 검증 오류 목록 */
  readonly issues: string[];
  /** corrupt일 때 원본(구조 복구·내보내기용) */
  readonly raw?: unknown;
  constructor(code: SaveStoreErrorCode, message: string, opts: { cause?: unknown; issues?: string[]; raw?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "SaveStoreError";
    this.code = code;
    this.issues = opts.issues ?? [];
    this.raw = opts.raw;
  }
}

export interface SaveBackend {
  get(): Promise<unknown>;
  put(value: unknown): Promise<void>;
  remove(): Promise<void>;
}

export function idbBackend(opts: { dbName?: string; storeName?: string; key?: string } = {}): SaveBackend {
  const dbName = opts.dbName ?? DB_NAME;
  const storeName = opts.storeName ?? STORE_NAME;
  const key = opts.key ?? SLOT_KEY;
  let dbp: Promise<IDBPDatabase> | null = null;
  const db = () => {
    if (typeof indexedDB === "undefined") return Promise.reject(new SaveStoreError("unavailable", "이 브라우저에서는 IndexedDB를 쓸 수 없습니다."));
    dbp ??= openDB(dbName, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(storeName)) d.createObjectStore(storeName);
      },
    }).catch((e) => {
      dbp = null;
      throw new SaveStoreError("unavailable", "저장소(IndexedDB)를 열지 못했습니다. 사생활 보호 모드이거나 저장 공간이 막혀 있을 수 있습니다.", { cause: e });
    });
    return dbp;
  };
  return {
    async get() {
      return (await db()).get(storeName, key);
    },
    async put(value) {
      await (await db()).put(storeName, value, key);
    },
    async remove() {
      await (await db()).delete(storeName, key);
    },
  };
}

/** 테스트·IndexedDB가 없는 환경용 */
export function memoryBackend(initial?: unknown): SaveBackend & { peek(): unknown } {
  let value: unknown = initial === undefined ? undefined : structuredClone(initial);
  return {
    async get() {
      return value === undefined ? undefined : structuredClone(value);
    },
    async put(v) {
      value = structuredClone(v);
    },
    async remove() {
      value = undefined;
    },
    peek: () => value,
  };
}

function isQuota(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export class SaveStore {
  constructor(
    private readonly backend: SaveBackend = idbBackend(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** 저장된 데이터. 없으면 null. 옛 버전은 마이그레이션해서 돌려준다 */
  async load(): Promise<SaveData | null> {
    let raw: unknown;
    try {
      raw = await this.backend.get();
    } catch (e) {
      if (e instanceof SaveStoreError) throw e;
      throw new SaveStoreError("read", "저장 데이터를 읽지 못했습니다.", { cause: e });
    }
    if (raw === undefined || raw === null) return null;
    try {
      return parseSave(raw);
    } catch (e) {
      const issues = e instanceof SaveImportError ? e.issues : [];
      const msg = e instanceof SaveImportError ? e.message.split("\n")[0] : "저장 데이터가 손상되었습니다.";
      throw new SaveStoreError("corrupt", msg, { cause: e, issues, raw });
    }
  }

  /** updatedAt을 지금으로 바꿔 저장하고, 저장한 데이터를 돌려준다(입력은 바꾸지 않음) */
  async save(data: SaveData): Promise<SaveData> {
    const out: SaveData = { ...data, updatedAt: this.clock().toISOString() };
    try {
      await this.backend.put(out);
    } catch (e) {
      if (e instanceof SaveStoreError) throw e;
      if (isQuota(e)) throw new SaveStoreError("quota", "저장 공간이 부족해서 저장하지 못했습니다. JSON으로 내보내 두세요.", { cause: e });
      throw new SaveStoreError("write", "저장하지 못했습니다.", { cause: e });
    }
    return out;
  }

  async clear(): Promise<void> {
    try {
      await this.backend.remove();
    } catch (e) {
      if (e instanceof SaveStoreError) throw e;
      throw new SaveStoreError("write", "저장 데이터를 지우지 못했습니다.", { cause: e });
    }
  }
}

export interface Autosaver {
  /** 마지막 호출 뒤 delayMs 동안 조용하면 저장 */
  schedule(data: SaveData): void;
  /** 대기 중인 저장을 즉시 실행(전투 종료·페이지 숨김 때) */
  flush(): Promise<void>;
  cancel(): void;
  readonly pending: boolean;
}

export function createAutosaver(
  store: Pick<SaveStore, "save">,
  opts: { delayMs?: number; onSaved?: (data: SaveData) => void; onError?: (e: SaveStoreError) => void } = {},
): Autosaver {
  const delay = opts.delayMs ?? 1000;
  let next: SaveData | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const run = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    const data = next;
    next = null;
    if (!data) return chain;
    // 저장 순서를 지키도록 이어서 실행
    chain = chain.then(async () => {
      try {
        const saved = await store.save(data);
        opts.onSaved?.(saved);
      } catch (e) {
        const err = e instanceof SaveStoreError ? e : new SaveStoreError("write", "저장하지 못했습니다.", { cause: e });
        if (opts.onError) opts.onError(err);
        else console.error(err);
      }
    });
    return chain;
  };

  return {
    schedule(data) {
      next = data;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), delay);
    },
    flush: run,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      next = null;
    },
    get pending() {
      return next !== null;
    },
  };
}

/** 브라우저가 저장소를 임의로 비우지 않도록 요청(최선 노력). 허용되면 true */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
