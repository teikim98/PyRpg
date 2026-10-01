// JSON 내보내기/불러오기(design.md §12.3 저장/불러오기).
import type { SaveData } from "../contracts/state";
import { SAVE_VERSION } from "./newGame";
import { validateSave } from "./validate";

export class SaveImportError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(issues.length ? `${message}\n${issues.map((i) => `- ${i}`).join("\n")}` : message);
    this.name = "SaveImportError";
    this.issues = issues;
  }
}

/**
 * 버전 n → n+1 변환. 저장 형식을 바꿀 때 여기에 추가하고 SAVE_VERSION을 올린다.
 * 예: MIGRATIONS[1] = (d) => ({ ...d, version: 2, newField: [] })
 */
export const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

/** 옛 버전 데이터를 현재 버전으로. 더 새로운 버전이면 오류 */
export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  const v = raw.version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new SaveImportError("저장 파일에 올바른 버전 정보(version)가 없습니다.");
  if (v > SAVE_VERSION) {
    throw new SaveImportError(`이 저장 파일은 더 새로운 게임 버전(v${v})에서 만들어졌습니다. 현재 게임은 v${SAVE_VERSION}까지 읽을 수 있습니다.`);
  }
  let data = raw;
  for (let cur = v; cur < SAVE_VERSION; cur++) {
    const step = MIGRATIONS[cur];
    if (!step) throw new SaveImportError(`v${cur} 저장 파일을 변환하는 방법이 없습니다.`);
    data = step(data);
  }
  return data;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function exportSave(data: SaveData, now: Date = new Date(data.updatedAt)): { text: string; filename: string } {
  const t = Number.isNaN(now.getTime()) ? new Date(0) : now;
  const stamp = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
  return { text: JSON.stringify(data, null, 2) + "\n", filename: `pyrpg-save-${stamp}.json` };
}

/** 문자열(또는 이미 파싱한 값)을 검증된 SaveData로. 실패하면 SaveImportError */
export function parseSave(raw: unknown): SaveData {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new SaveImportError("저장 데이터는 JSON 객체여야 합니다.");
  const migrated = migrateSave(raw as Record<string, unknown>);
  const r = validateSave(migrated);
  if (!r.ok) throw new SaveImportError("저장 파일의 내용이 올바르지 않습니다.", r.errors);
  return r.value;
}

export function importSave(text: string): SaveData {
  if (typeof text !== "string" || text.trim() === "") throw new SaveImportError("파일이 비어 있습니다.");
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    throw new SaveImportError(`JSON 형식이 아닙니다. PyRpg에서 내보낸 저장 파일인지 확인해 주세요. (${(e as Error).message})`);
  }
  return parseSave(raw);
}
