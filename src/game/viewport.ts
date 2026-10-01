// 화면 크기 계산과 에셋 확인. Phaser에 의존하지 않는다.
import { manifest } from "../contracts/assets";

/** 기준 내부 해상도. 부모 요소에 맞춰 정수 배율로 키우고, 남는 공간은 더 넓은 시야로 쓴다 */
export const BASE_WIDTH = 320;
export const BASE_HEIGHT = 180;

export function computeViewport(width: number, height: number): { zoom: number; width: number; height: number } {
  const w = width > 0 ? width : BASE_WIDTH * 3;
  const h = height > 0 ? height : BASE_HEIGHT * 3;
  const zoom = Math.max(1, Math.floor(Math.min(w / BASE_WIDTH, h / BASE_HEIGHT)));
  return { zoom, width: Math.max(1, Math.floor(w / zoom)), height: Math.max(1, Math.floor(h / zoom)) };
}

/** manifest가 가리키는 지형·스프라이트 파일 목록(assets/ 기준 상대 경로) */
export function manifestImageFiles(): string[] {
  return [...Object.values(manifest.tilesets).map((t) => t.file), ...Object.values(manifest.sprites).map((s) => s.file)];
}

/**
 * 실제로 있는 이미지 파일만 골라낸다(HEAD 요청). 없는 PNG를 로더에 넣으면 콘솔 오류가 쏟아지고,
 * vite 서버는 없는 경로에 index.html을 200으로 돌려주기도 하므로 Content-Type까지 본다.
 * 확인 자체가 불가능하면 null(전부 시도).
 */
export async function probeImages(base: string, files: string[]): Promise<Set<string> | null> {
  if (typeof fetch !== "function") return null;
  try {
    const ok = new Set<string>();
    await Promise.all(
      files.map(async (f) => {
        try {
          const r = await fetch(base + f, { method: "HEAD", cache: "no-cache" });
          if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) ok.add(f);
        } catch {
          // 이 파일만 없음으로 처리
        }
      }),
    );
    return ok;
  } catch {
    return null;
  }
}
