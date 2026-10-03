// 타일 애니메이션(manifest의 tileAnimations). Phaser에 의존하지 않는 순수 코드.
//
// 형식: { "water": { "frames": ["water", "water_a1", "water_a2"], "fps": 3 } }
// - 키는 맵에 칠해진 타일 이름(= frames[0]). 애니메이션 프레임 타일은 타일셋 끝에 추가되어 있다.
// - 맵 데이터는 바꾸지 않는다. Phaser 타일셋의 tileData[id].animation(Tiled 형식)으로 넘기면
//   TilemapLayer가 그릴 때 프레임을 고른다(매 프레임 CPU 작업 없음).
import type { TileAnimationDef } from "../contracts/assets";

export interface PhaserTileAnimData {
  animation: { tileid: number; duration: number; startTime: number }[];
  animationDuration: number;
}

export interface ResolvedTileAnimation {
  name: string;
  /** 타일셋 인덱스(0부터). frames[0]이 맵에 칠해진 타일 */
  frames: number[];
  frameMs: number;
}

/**
 * manifest 정의를 타일셋 인덱스로 바꾼다. 잘못된 항목(없는 타일 이름, 프레임 1개 이하, fps ≤ 0)은 건너뛰고
 * problems에 이유를 남긴다.
 */
export function resolveTileAnimations(
  defs: Record<string, TileAnimationDef> | undefined,
  tiles: readonly string[],
  problems: string[] = [],
): ResolvedTileAnimation[] {
  const out: ResolvedTileAnimation[] = [];
  for (const [name, def] of Object.entries(defs ?? {})) {
    const frames = Array.isArray(def?.frames) ? def.frames : [];
    const fps = typeof def?.fps === "number" ? def.fps : 0;
    if (frames.length < 2) {
      problems.push(`${name}: frames는 2개 이상`);
      continue;
    }
    if (!(fps > 0)) {
      problems.push(`${name}: fps는 0보다 커야 함`);
      continue;
    }
    if (frames[0] !== name) problems.push(`${name}: frames[0]이 ${name}이 아님(그대로 frames[0]을 기준으로 씀)`);
    const idx = frames.map((f) => tiles.indexOf(f));
    const missing = frames.filter((_, i) => idx[i] < 0);
    if (missing.length) {
      problems.push(`${name}: 타일셋에 없는 프레임 ${missing.join(", ")}`);
      continue;
    }
    out.push({ name, frames: idx, frameMs: 1000 / fps });
  }
  return out;
}

/** Phaser Tileset.tileData에 넣을 값(키 = frames[0]의 타일셋 인덱스) */
export function phaserTileData(anims: readonly ResolvedTileAnimation[]): Record<number, PhaserTileAnimData> {
  const data: Record<number, PhaserTileAnimData> = {};
  for (const a of anims) {
    let t = 0;
    const animation = a.frames.map((tileid) => {
      const frame = { tileid, duration: a.frameMs, startTime: t };
      t += a.frameMs;
      return frame;
    });
    data[a.frames[0]] = { animation, animationDuration: t };
  }
  return data;
}

/** elapsed ms 시점에 base 타일 자리에 보이는 타일 인덱스(Phaser와 같은 규칙. 테스트·디버그용) */
export function animatedTileAt(data: Record<number, PhaserTileAnimData>, base: number, elapsed: number): number {
  const d = data[base];
  if (!d) return base;
  const t = ((elapsed % d.animationDuration) + d.animationDuration) % d.animationDuration;
  for (const f of d.animation) if (t >= f.startTime && t < f.startTime + f.duration) return f.tileid;
  return d.animation[d.animation.length - 1].tileid;
}

/** 맵 레이어 데이터에서 애니메이션되는 칸 수(디버그·테스트용) */
export function countAnimatedCells(layers: readonly (readonly number[])[], data: Record<number, PhaserTileAnimData>): number {
  let n = 0;
  for (const layer of layers) for (const v of layer) if (v >= 0 && data[v]) n++;
  return n;
}
