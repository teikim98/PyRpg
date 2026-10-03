// 캐릭터(player, nuri, npc_*) 시트 판별과 프레임 계산. Phaser에 의존하지 않는 순수 코드(단위 테스트 대상).
//
// 새 시트(docs/art-overhaul/plan.md §3): 16×24 프레임, 가로 6열 × 세로 4행.
//   행 = 아래·왼쪽·오른쪽·위(FACING_ROW), 열 = 0 서기, 1 왼발, 2 서기, 3 오른발, 4 숨쉬기, 5 눈 깜빡임.
//   프레임 번호 = 행 × 6 + 열.
// 옛 시트: 16×16 프레임, 가로 8프레임 = 방향 × [서기, 걸음]. 숨쉬기·깜빡임은 서기 프레임으로 대신한다.
import type { Facing } from "../contracts/state";
import type { CharacterSheetLayout } from "../contracts/world";
import { FACING_ROW } from "./grid";

export type SheetLayout = CharacterSheetLayout;

export const SHEET_COLS = 6;
export const SHEET_ROWS = 4;

/** 새 시트의 열 */
export const COL = { stand: 0, stepLeft: 1, pass: 2, stepRight: 3, breathe: 4, blink: 5 } as const;

/** 한 걸음(한 칸, STEP_MS)에 보이는 걷기 프레임 수. 두 걸음이 한 주기 */
export const FRAMES_PER_STEP = 2;
/** 걷기 주기(반 걸음 단위 위상 → 열): 왼발, 서기, 오른발, 서기 */
export const WALK_CYCLE: readonly number[] = [COL.stepLeft, COL.pass, COL.stepRight, COL.stand];
/** 발 딛는 프레임에서 몸이 올라가는 높이(px) */
export const WALK_BOB_PX = 1;

/** 멈춘 뒤 숨쉬기를 시작하기까지(ms) */
export const BREATHE_DELAY_MS = 1500;
/** 숨쉬기 한 주기(ms): 앞 BREATHE_IN_MS는 서기, 나머지는 숨쉬기 프레임 */
export const BREATHE_PERIOD_MS = 1800;
export const BREATHE_IN_MS = 1100;
/** 눈 깜빡임 길이(ms)와, 멈추고 첫 깜빡임까지 최소 시간 */
export const BLINK_MS = 140;
export const BLINK_MIN_IDLE_MS = 700;
/** 막힌 칸을 향해 키를 누르고 있을 때 제자리걸음 한 프레임(ms) */
export const BUMP_FRAME_MS = 210;

/**
 * 시트 형식 판별. 프레임이 세로로 긴(16×24) 시트이고 6×4 = 24프레임 이상이면 새 형식,
 * 아니면 옛 형식(16×16 × 8)으로 본다.
 */
export function detectSheetLayout(frameWidth: number, frameHeight: number, frameCount: number): SheetLayout {
  return frameHeight > frameWidth && frameCount >= SHEET_COLS * SHEET_ROWS ? "grid6x4" : "legacy8";
}

/** 방향과 열 → 시트의 프레임 번호 */
export function sheetFrame(layout: SheetLayout, frameCount: number, facing: Facing, col: number): number {
  const row = FACING_ROW[facing];
  if (layout === "grid6x4") return row * SHEET_COLS + col;
  const step = col === COL.stepLeft || col === COL.stepRight ? 1 : 0;
  return (row * 2 + step) % Math.max(1, frameCount);
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** 반 걸음 단위 위상 → 걷기 열 */
export function walkColumn(halfStep: number): number {
  return WALK_CYCLE[mod(halfStep, WALK_CYCLE.length)];
}

/** 발 딛는 프레임(1, 3)이면 몸을 올린다 */
export function bobFor(col: number): number {
  return col === COL.stepLeft || col === COL.stepRight ? WALK_BOB_PX : 0;
}

/** 멈춰 선 지 elapsed ms 뒤의 열(서기 → 숨쉬기, 가끔 깜빡임). seed로 캐릭터마다 깜빡이는 때가 다르다 */
export function idleColumn(elapsed: number, seed = 0): number {
  const blinkPeriod = 3300 + mod(seed, 7) * 260;
  if (elapsed >= BLINK_MIN_IDLE_MS && mod(elapsed + seed * 977, blinkPeriod) < BLINK_MS) return COL.blink;
  if (elapsed < BREATHE_DELAY_MS) return COL.stand;
  return mod(elapsed - BREATHE_DELAY_MS + seed * 131, BREATHE_PERIOD_MS) < BREATHE_IN_MS ? COL.stand : COL.breathe;
}

export interface AnimSample {
  facing: Facing;
  col: number;
  /** 몸을 올리는 높이(px) */
  bob: number;
}

type Mode = "idle" | "walk" | "bump";

/**
 * 캐릭터 하나의 애니메이션 상태. 시간(now, ms)은 바깥에서 넣는다.
 * 걸음 번호(stepIndex)는 멈춰도 초기화하지 않으므로, 이어 걸으면 다음 발부터 나온다.
 */
export class CharacterAnimator {
  facing: Facing;
  private mode: Mode = "idle";
  private since = 0;
  /** 지금(또는 마지막) 걸음의 번호 */
  stepIndex = -1;
  private stepMs = 135;

  /**
   * @param seed 깜빡임·숨쉬기 엇갈림
   * @param phaseOffset 반 걸음 단위로 위상을 미룬다(누리 = 1: 플레이어와 반 박자 어긋남)
   */
  constructor(
    facing: Facing = "down",
    private seed = 0,
    private phaseOffset = 0,
  ) {
    this.facing = facing;
  }

  get state(): Mode {
    return this.mode;
  }

  /** 한 칸 걷기 시작. stepIndex를 주면 그 번호를 쓴다(누리를 플레이어 걸음에 맞출 때) */
  beginStep(facing: Facing, now: number, stepMs: number, stepIndex?: number): void {
    this.facing = facing;
    this.mode = "walk";
    this.since = now;
    this.stepMs = stepMs;
    this.stepIndex = stepIndex ?? this.stepIndex + 1;
  }

  /** 멈춤. 이미 같은 방향으로 서 있으면(force가 아니면) 숨쉬기 시계를 다시 시작하지 않는다 */
  stop(now: number, facing: Facing = this.facing, force = false): void {
    if (!force && this.mode === "idle" && facing === this.facing) return;
    this.facing = facing;
    this.mode = "idle";
    this.since = now;
  }

  /** 막힌 칸 쪽으로 키를 누르고 있음: 그 방향을 보고 제자리걸음 */
  bump(facing: Facing, now: number): void {
    if (this.mode === "bump" && facing === this.facing) return;
    this.facing = facing;
    this.mode = "bump";
    this.since = now;
  }

  sample(now: number): AnimSample {
    const t = Math.max(0, now - this.since);
    if (this.mode === "walk") {
      const half = Math.min(FRAMES_PER_STEP - 1, Math.floor((t / this.stepMs) * FRAMES_PER_STEP));
      const col = walkColumn(this.stepIndex * FRAMES_PER_STEP + half + this.phaseOffset);
      return { facing: this.facing, col, bob: bobFor(col) };
    }
    if (this.mode === "bump") {
      return { facing: this.facing, col: walkColumn(Math.floor(t / BUMP_FRAME_MS)), bob: 0 };
    }
    return { facing: this.facing, col: idleColumn(t, this.seed), bob: 0 };
  }
}
