// 지역 분위기(region.json의 ambience): 색 보정 프리셋과 떠다니는 입자. Phaser에 의존하지 않는 순수 코드.
// 그리기(카메라 필터·입자 오브젝트)는 ambienceFx.ts가 맡는다.
//
// region.json: "ambience": { "grade": "dusty_teal", "particles": "sparkle" } (둘 다 선택)
// 멈춘 세계라서 입자는 '천천히 떠 있는' 느낌으로 아주 느리게 움직인다.
import type { RegionAmbience } from "../contracts/content";

/** 색 보정 프리셋 이름. tools/verify_content.py의 AMBIENCE_GRADES와 같아야 한다(단위 테스트가 확인) */
export const GRADE_NAMES = ["dusty_teal", "forest", "cave", "library", "harbor", "lake"] as const;
/** 입자 종류. tools/verify_content.py의 AMBIENCE_PARTICLES와 같아야 한다 */
export const PARTICLE_KINDS = ["none", "sparkle", "dust", "leaves", "spray", "mist"] as const;

export type GradeName = (typeof GRADE_NAMES)[number];
export type ParticleKind = (typeof PARTICLE_KINDS)[number];

export const DEFAULT_GRADE: GradeName = "dusty_teal";
export const DEFAULT_PARTICLES: ParticleKind = "none";

export interface GradePreset {
  /** -1(흑백) ~ 0(그대로) ~ +(진하게) */
  saturation: number;
  /** -1 ~ 0(그대로) ~ + */
  contrast: number;
  /** 밝기 배율(1 = 그대로) */
  brightness: number;
  /** 채널별 곱(1 = 그대로) */
  tint: [number, number, number];
  /** 채널별 더하기(0~255). 그늘을 그 색으로 띄운다 */
  lift: [number, number, number];
  vignette: {
    /** 정규화 반지름. 화면 모서리(0.71)보다 커야 모서리가 끊기지 않는다 */
    radius: number;
    strength: number;
    /** MULTIPLY로 곱하는 색(밝을수록 약함) */
    color: number;
  };
}

/** Doloc Town의 차분한 청록·먼지빛을 기본으로, 지역마다 조금씩 */
export const GRADE_PRESETS: Record<GradeName, GradePreset> = {
  dusty_teal: {
    saturation: -0.14,
    contrast: -0.04,
    brightness: 1.0,
    tint: [0.97, 1.0, 1.02],
    lift: [7, 11, 13],
    vignette: { radius: 0.8, strength: 0.26, color: 0x6f7f8c },
  },
  forest: {
    saturation: -0.08,
    contrast: -0.03,
    brightness: 0.99,
    tint: [0.96, 1.02, 0.95],
    lift: [5, 10, 6],
    vignette: { radius: 0.8, strength: 0.27, color: 0x5d7360 },
  },
  cave: {
    saturation: -0.2,
    contrast: 0.02,
    brightness: 0.95,
    tint: [0.98, 0.97, 1.04],
    lift: [8, 6, 14],
    vignette: { radius: 0.78, strength: 0.32, color: 0x3e3a52 },
  },
  library: {
    saturation: -0.12,
    contrast: -0.03,
    brightness: 0.98,
    tint: [1.04, 1.0, 0.92],
    lift: [10, 7, 3],
    vignette: { radius: 0.8, strength: 0.29, color: 0x6a5848 },
  },
  harbor: {
    saturation: -0.1,
    contrast: -0.02,
    brightness: 1.01,
    tint: [0.97, 1.0, 1.03],
    lift: [5, 9, 13],
    vignette: { radius: 0.82, strength: 0.23, color: 0x687e8e },
  },
  lake: {
    saturation: -0.16,
    contrast: -0.05,
    brightness: 1.01,
    tint: [0.96, 1.0, 1.04],
    lift: [9, 11, 17],
    vignette: { radius: 0.8, strength: 0.25, color: 0x72849a },
  },
};

export interface ResolvedAmbience {
  grade: GradeName;
  particles: ParticleKind;
}

const isGrade = (v: unknown): v is GradeName => typeof v === "string" && (GRADE_NAMES as readonly string[]).includes(v);
const isParticles = (v: unknown): v is ParticleKind =>
  typeof v === "string" && (PARTICLE_KINDS as readonly string[]).includes(v);

/** region.json 값 → 프리셋. 없거나 모르는 이름은 기본값(problems에 이유) */
export function resolveAmbience(raw: RegionAmbience | undefined | null, problems: string[] = []): ResolvedAmbience {
  const out: ResolvedAmbience = { grade: DEFAULT_GRADE, particles: DEFAULT_PARTICLES };
  if (!raw) return out;
  if (raw.grade !== undefined) {
    if (isGrade(raw.grade)) out.grade = raw.grade;
    else problems.push(`모르는 grade: ${String(raw.grade)}`);
  }
  if (raw.particles !== undefined) {
    if (isParticles(raw.particles)) out.particles = raw.particles;
    else problems.push(`모르는 particles: ${String(raw.particles)}`);
  }
  return out;
}

// ── 색 행렬(4×5, 더하기 열은 0~255. Phaser.Display.ColorMatrix.set과 같은 형식) ──
export type Matrix20 = number[];

const IDENTITY: Matrix20 = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** b를 먼저, 그다음 a를 적용하는 행렬(a ∘ b) */
export function composeMatrix(a: Matrix20, b: Matrix20): Matrix20 {
  const out: number[] = new Array(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      if (c === 4) v += a[r * 5 + 4];
      out[r * 5 + c] = v;
    }
  }
  return out;
}

/** Phaser ColorMatrix.saturate와 같은 식 */
function saturateMatrix(value: number): Matrix20 {
  const x = (value * 2) / 3 + 1;
  const y = (x - 1) * -0.5;
  return [x, y, y, 0, 0, y, x, y, 0, 0, y, y, x, 0, 0, 0, 0, 0, 1, 0];
}

/** Phaser ColorMatrix.contrast와 같은 식(더하기는 0~255로) */
function contrastMatrix(value: number): Matrix20 {
  const v = value + 1;
  const o = -0.5 * (v - 1) * 255;
  return [v, 0, 0, 0, o, 0, v, 0, 0, o, 0, 0, v, 0, o, 0, 0, 0, 1, 0];
}

function scaleMatrix(r: number, g: number, b: number, lift: [number, number, number] = [0, 0, 0]): Matrix20 {
  return [r, 0, 0, 0, lift[0], 0, g, 0, 0, lift[1], 0, 0, b, 0, lift[2], 0, 0, 0, 1, 0];
}

/** 프리셋 → 색 행렬(채도 → 대비 → 밝기 → 색 곱·그늘 띄우기 순서) */
export function gradeMatrix(p: GradePreset): Matrix20 {
  let m = IDENTITY;
  m = composeMatrix(saturateMatrix(p.saturation), m);
  m = composeMatrix(contrastMatrix(p.contrast), m);
  m = composeMatrix(scaleMatrix(p.brightness, p.brightness, p.brightness), m);
  m = composeMatrix(scaleMatrix(p.tint[0], p.tint[1], p.tint[2], p.lift), m);
  return m;
}

/** 색 행렬을 RGB(0~255)에 적용(테스트용) */
export function applyMatrix(m: Matrix20, rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb;
  const ch = (i: number) => Math.max(0, Math.min(255, m[i * 5] * r + m[i * 5 + 1] * g + m[i * 5 + 2] * b + m[i * 5 + 3] * 255 + m[i * 5 + 4]));
  return [ch(0), ch(1), ch(2)];
}

// ── 떠다니는 입자 ──
export type ParticleShape = "dot" | "plus" | "star" | "leaf" | "blob";

export interface ParticleSpec {
  /** 320×180 화면에 띄울 개수(화면 크기에 비례, max가 상한) */
  density: number;
  max: number;
  colors: number[];
  /** 모양(뽑기 비율만큼 반복해서 적는다) */
  shapes: ParticleShape[];
  /** 속도(px/s) 범위 */
  vx: [number, number];
  vy: [number, number];
  /** 좌우 흔들림 폭(px)과 주기(ms) */
  swayPx: number;
  swayMs: [number, number];
  alpha: [number, number];
  /** 반짝임(투명도 맥박) 주기(ms). 없으면 일정 */
  twinkleMs?: [number, number];
  /** 반짝임 때 가장 어두운 비율(0이면 완전히 사라졌다 나타남) */
  twinkleFloor?: number;
  /**
   * 투명도 대신 모양으로 반짝인다(도트 반짝임: 안 보임 → 점 → 십자 → 별 → 십자 → 점).
   * 값은 [점, 십자, 별]이 되는 맥박 문턱값
   */
  twinkleShapes?: [number, number, number];
}

export const PARTICLE_SPECS: Record<Exclude<ParticleKind, "none">, ParticleSpec> = {
  sparkle: {
    density: 20,
    max: 30,
    colors: [0xffd23f, 0xffe066, 0xfff09a],
    shapes: ["dot"],
    vx: [-1.2, 1.2],
    vy: [-2.4, -0.6],
    swayPx: 3,
    swayMs: [4200, 7600],
    alpha: [0.8, 1],
    twinkleMs: [1600, 3400],
    twinkleShapes: [0.35, 0.7, 0.93],
  },
  dust: {
    density: 22,
    max: 34,
    colors: [0xeadfc4, 0xd9d0bb, 0xcbd6cf],
    shapes: ["dot"],
    vx: [-1.6, 1.6],
    vy: [-1, 0.8],
    swayPx: 2,
    swayMs: [5000, 9000],
    alpha: [0.25, 0.6],
    twinkleMs: [3000, 6000],
    twinkleFloor: 0.4,
  },
  leaves: {
    density: 9,
    max: 14,
    colors: [0x9bb35a, 0xc9a24a, 0x7f9a46, 0xcf8848],
    shapes: ["leaf"],
    vx: [1.5, 4],
    vy: [2, 4],
    swayPx: 5,
    swayMs: [2800, 4600],
    alpha: [0.85, 1],
  },
  spray: {
    density: 16,
    max: 26,
    colors: [0xf0f8ff, 0xcfe8f2, 0xb8dcea],
    shapes: ["dot", "dot", "plus"],
    vx: [2.5, 6],
    vy: [-1.6, 0.4],
    swayPx: 2,
    swayMs: [3000, 5200],
    alpha: [0.4, 0.9],
    twinkleMs: [1600, 3200],
    twinkleFloor: 0.2,
  },
  mist: {
    density: 6,
    max: 9,
    colors: [0xe3ecf2, 0xd2dee8],
    shapes: ["blob"],
    vx: [0.8, 2.2],
    vy: [-0.3, 0.3],
    swayPx: 1,
    swayMs: [7000, 11000],
    alpha: [0.1, 0.2],
    twinkleMs: [6000, 10000],
    twinkleFloor: 0.5,
  },
};

/** 결정적 난수(mulberry32). 같은 지역이면 같은 배치 → 스크린샷이 안정적 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export interface Particle {
  /** 흔들림을 뺀 기준 위치(월드 좌표) */
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  shape: ParticleShape;
  baseAlpha: number;
  swayMs: number;
  twinkleMs: number;
  phase: number;
}

export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 화면 밖으로 나가도 이만큼은 그대로 두고, 더 나가면 반대쪽으로 감는다 */
export const WRAP_MARGIN = 10;

export function particleCount(spec: ParticleSpec, view: Pick<View, "width" | "height">): number {
  return Math.min(spec.max, Math.max(1, Math.round((spec.density * view.width * view.height) / (320 * 180))));
}

export function spawnParticles(spec: ParticleSpec, view: View, seed: number): Particle[] {
  const r = rng(seed);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length];
  const range = ([a, b]: [number, number]) => a + (b - a) * r();
  const n = particleCount(spec, view);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: view.x + r() * view.width,
      y: view.y + r() * view.height,
      vx: range(spec.vx),
      vy: range(spec.vy),
      color: pick(spec.colors),
      shape: pick(spec.shapes),
      baseAlpha: range(spec.alpha),
      swayMs: range(spec.swayMs),
      twinkleMs: spec.twinkleMs ? range(spec.twinkleMs) : 0,
      phase: r() * Math.PI * 2,
    });
  }
  return out;
}

/** dt ms만큼 움직이고, 화면(+여유) 밖이면 반대쪽으로 감는다 */
export function stepParticle(p: Particle, dtMs: number, view: View): void {
  p.x += (p.vx * dtMs) / 1000;
  p.y += (p.vy * dtMs) / 1000;
  const left = view.x - WRAP_MARGIN;
  const top = view.y - WRAP_MARGIN;
  const w = view.width + WRAP_MARGIN * 2;
  const h = view.height + WRAP_MARGIN * 2;
  if (p.x < left || p.x >= left + w) p.x = left + ((((p.x - left) % w) + w) % w);
  if (p.y < top || p.y >= top + h) p.y = top + ((((p.y - top) % h) + h) % h);
}

/** 그 시점에 그릴 위치(흔들림 포함), 투명도, 모양(null이면 안 보임) */
export function particleDisplay(
  p: Particle,
  spec: ParticleSpec,
  now: number,
): { x: number; y: number; alpha: number; shape: ParticleShape | null } {
  const sway = Math.sin((now / p.swayMs) * Math.PI * 2 + p.phase) * spec.swayPx;
  let alpha = p.baseAlpha;
  let shape: ParticleShape | null = p.shape;
  if (p.twinkleMs > 0) {
    const pulse = 0.5 + 0.5 * Math.sin((now / p.twinkleMs) * Math.PI * 2 + p.phase * 1.7);
    const steps = spec.twinkleShapes;
    if (steps) {
      shape = pulse >= steps[2] ? "star" : pulse >= steps[1] ? "plus" : pulse >= steps[0] ? "dot" : null;
    } else {
      const floor = spec.twinkleFloor ?? 0.3;
      alpha *= floor + (1 - floor) * pulse;
    }
  }
  return { x: p.x + sway, y: p.y, alpha, shape };
}
