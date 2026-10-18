// 그림자 게시판(design.md §7.6, phase3/plan.md §5.1): 하루 계획(오늘의 목록과 그림자마다 낼 문제)과, 그림자전에 낼 변형 문제.
// 단위 3-E2: 대기·15분 예산·칸 3 이상 회전·이름 숨김·보스 2페이즈·보상 정규화(improvements/README.md "통합된 그림자·변형 출제 규칙").
import type { BossPhase, Problem, ProblemVariant } from "../contracts/content";
import type { SaveData, ShadowEntry } from "../contracts/state";
import { DAILY_SHADOW_LIMIT, DAILY_SHADOW_MINUTES, dueShadows, intervalFor, isReturnShadow, MAX_BOX, NEVER_DUE, shadowCandidates } from "./shadows";
import { daysBetween, studyDate } from "./time";

/** 이 칸부터 이름을 숨기고(이름 없는 그림자), 같은 개념의 이미 푼 문제를 돌려 내고, 보스면 2페이즈까지 낸다(§7.6) */
export const SHADOW_ANON_BOX = 3;
/** 칸 3 이상 그림자의 이름(게시판·적 이름·제목) */
export const SHADOW_ANON_NAME = "이름 없는 그림자";
/** 칸 3 이상 보스 그림자의 2페이즈 시작 대사(공통 문장. 풀이 방향을 말하지 않고 입력이 커졌다는 것만, R7) */
export const SHADOW_PHASE2_INTRO = "그림자가 시간 결계를 펼쳤어! 이제 입력이 아주 커졌어. 정확할 뿐 아니라 빨라야 해.";
/**
 * 칸 3 이상 보스 그림자의 지문 끝에 붙이는 2페이즈 안내. 보스 변형 지문은 1페이즈 범위만 적혀 있으므로(design.md §7.6 변형 작성 규칙)
 * 2페이즈 입력이 그 범위를 넘는다는 것을 알린다. 원래 보스 지문의 안내 문장은 몬스터 이름이 들어 있어 쓰지 않는다
 */
export const SHADOW_PHASE2_NOTE = "> 1페이즈를 통과하면 그림자가 '시간 결계'를 펼치고 2페이즈가 시작됩니다. 2페이즈에서는 입력이 위 범위보다 훨씬 커지고 시간 제한이 걸립니다.";
/**
 * 2페이즈를 붙이지 않는 보스(1페이즈만 내고 예상 시간은 절반, 결정 23 P-E11).
 * 기준: Pyodide에서 첫 시전(입력 생성 포함) 20초, 두 번째 시전 10초, slow.py 시전 15초 가운데 하나라도 넘으면 제외.
 * 값은 tests/e2e/shadow-measure.spec.ts(PYRPG_MEASURE_SHADOW=1)로 잰 결과(design.md §7.6 보스 그림자).
 * 2026-10-19 이 PC 단독 측정(중앙값): 가장 긴 P0411도 첫 6.3초·두 번째 1.8초·slow.py 5.8초라 보스 7개 모두 포함(빈 목록)
 */
export const SHADOW_PHASE2_EXCLUDE: ReadonlySet<string> = new Set<string>();
/** 보스 그림자 보상의 기준(일반 전투 보상, design.md §7.1). 여기에 그림자 비율 50%가 곱해져 50 XP·25골드 */
export const SHADOW_BOSS_BASE_REWARD = { xp: 100, gold: 50 } as const;

export interface BoardShadow {
  entry: ShadowEntry;
  overdueDays: number;
  /** 한 칸 올라가면 다음 출현까지 일수(칸 5에서 이기면 정화 → 0) */
  nextIntervalDays: number;
  returning: boolean;
}

function boardShadow(entry: ShadowEntry, today: string): BoardShadow {
  return {
    entry,
    overdueDays: Math.max(0, daysBetween(entry.due, today)),
    nextIntervalDays: entry.purified || entry.box >= MAX_BOX ? 0 : intervalFor(entry.box + 1),
    returning: isReturnShadow(entry),
  };
}

/** 개수 상한만 본 오늘의 그림자(대기·예산 없음). 게임 화면은 planShadows를 쓴다 */
export function boardShadows(save: Pick<SaveData, "shadows" | "history">, now: Date): BoardShadow[] {
  const today = studyDate(now);
  return dueShadows(save, now).map((entry) => boardShadow(entry, today));
}

/** 등록돼 있지만 오늘은 나타나지 않는 그림자 수(정화 대기 제외) */
export function waitingShadows(save: Pick<SaveData, "shadows">, now: Date): number {
  const today = studyDate(now);
  return save.shadows.filter((s) => !s.purified && s.due > today).length;
}

/** 정화된 그림자(코덱스의 '정화된 그림자' 목록) */
export function purifiedShadows(save: Pick<SaveData, "shadows">): ShadowEntry[] {
  return save.shadows.filter((s) => s.purified);
}

export function returnCleared(e: ShadowEntry): boolean {
  return e.purified && e.due === NEVER_DUE;
}

// ───────────── 하루 계획(design.md §7.6 하루 운영 1~7) ─────────────

/** 오늘 계획에 담긴 그림자 하나: 실제로 낼 문제까지 정해져 있다(게시판·출제·퀘스트가 같은 항목을 쓴다) */
export interface ShadowPlanItem extends BoardShadow {
  /** 실제로 고른 원래 문제(칸 0~2는 대표 문제, 칸 3 이상은 같은 개념에서 돌려 고른 것) */
  original: Problem;
  /** 그림자전에 낼 문제(변형, 칸 3 이상이면 이름을 숨기고 보스는 2페이즈까지) */
  problem: Problem;
  /** 예상 분: 원래 문제의 estimatedMinutes, 보스를 1페이즈만 내면 절반(올림) */
  minutes: number;
  /** 칸 3 이상: '이름 없는 그림자'(이긴 뒤 공개) */
  anonymous: boolean;
  /** 원래 보스의 2페이즈를 붙였는가 */
  twoPhase: boolean;
}

/** 대기: 대표 문제를 아직 처치하지 못했거나(unsolved) 오늘 처치한(solvedToday) 그림자. 다음 학습일부터 후보 */
export interface ShadowPending extends BoardShadow {
  reason: "unsolved" | "solvedToday";
  anonymous: boolean;
}

export interface ShadowPlan {
  /** 오늘 남은 그림자(정렬 순서, 오늘 치른 것은 빠짐) */
  items: ShadowPlanItem[];
  pending: ShadowPending[];
  /** 오늘 이미 치른 그림자의 예상 분 합(AttemptLog.budgetMinutes) */
  usedMinutes: number;
  /** items의 예상 분 합 */
  plannedMinutes: number;
  /** 오늘 이미 치른 그림자 수(개념 단위) */
  fought: number;
  /** 후보였지만 하루 상한(3마리·15분)에 걸려 내일로 넘어간 수 */
  deferred: number;
}

/** 변형 ID·원래 ID → 원래 문제 */
function ownerIndex(problems: readonly Problem[]): Map<string, Problem> {
  const m = new Map<string, Problem>();
  for (const p of problems) {
    m.set(p.id, p);
    for (const v of p.variants ?? []) m.set(v.id, p);
  }
  return m;
}

/** 그림자로 낸 원래 문제의 예상 분(1페이즈만이면 보스 절반 올림) */
export function shadowMinutes(original: Pick<Problem, "boss" | "estimatedMinutes">, twoPhase: boolean): number {
  return original.boss && !twoPhase ? Math.ceil(original.estimatedMinutes / 2) : original.estimatedMinutes;
}

const byRegionId = (a: Problem, b: Problem) => (a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * 칸 3 이상에서 낼 원래 문제: 같은 concept의 이미 푼 문제(보스·응용·연습 포함) 가운데 직전에 그림자로 낸 것을 빼고
 * 그림자로 가장 오래 나오지 않은 것(한 번도 안 나온 것이 먼저, 동률은 지역·ID 순). 후보가 하나뿐이면 그것(대표 문제)
 */
function rotateOriginal(rep: Problem, pool: Problem[], shadowLogs: SaveData["history"], owner: Map<string, Problem>): Problem {
  if (pool.length <= 1) return rep;
  const lastAt = new Map<string, string>();
  let lastId: string | undefined;
  for (const h of shadowLogs) {
    const o = owner.get(h.problemId);
    if (!o || o.concept !== rep.concept) continue;
    if (!lastAt.has(o.id) || h.at > lastAt.get(o.id)!) lastAt.set(o.id, h.at);
  }
  for (const [id, t] of lastAt) if (lastId === undefined || t > lastAt.get(lastId)!) lastId = id;
  const rest = pool.filter((p) => p.id !== lastId);
  const list = rest.length ? rest : pool;
  return [...list].sort((a, b) => {
    const ta = lastAt.get(a.id) ?? "";
    const tb = lastAt.get(b.id) ?? "";
    return ta < tb ? -1 : ta > tb ? 1 : byRegionId(a, b);
  })[0]!;
}

/**
 * 하루 계획(design.md §7.6 하루 운영). 오늘 이전의 기록과 지금의 그림자 칸만으로 계산하므로 같은 학습일에 다시 불러도
 * "처음 목록 − 오늘 치른 것"이 나온다(오늘 치른 그림자는 출현일이 내일 이후로 밀려 후보에서 빠지고, 그 예상 분이 예산에 들어간다).
 * 1. 후보: 출현일이 오늘 이전. 2. 대기: 대표 문제가 오늘 이전에 처치되지 않은 것. 3. 정렬: 연체일 → 칸 → 등록 → 개념.
 * 4. 낼 문제: 칸 0~2는 대표 문제의 변형, 칸 3 이상은 회전(rotateOriginal) + 이름 숨김 + 보스 2페이즈.
 * 5. 예상 분. 6. 담기: 최대 (3 − 오늘 치른 수)마리, 오늘 치른 분 + 담을 분이 15분을 넘는 지점에서 멈춤(건너뛰지 않음),
 *    오늘 아직 하나도 치르지 않았으면 첫 1마리는 시간과 관계없이.
 */
export function planShadows(save: Pick<SaveData, "shadows" | "history" | "problems">, problems: readonly Problem[], now: Date): ShadowPlan {
  const today = studyDate(now);
  const owner = ownerIndex(problems);
  const dayOf = (iso: string) => studyDate(new Date(iso));
  const before = save.history.filter((h) => dayOf(h.at) < today);
  const shadowBefore = before.filter((h) => h.shadow);
  const todayShadow = save.history.filter((h) => h.shadow && dayOf(h.at) === today);
  const fought = new Set(todayShadow.map((h) => h.concept)).size;
  let usedMinutes = 0;
  for (const h of todayShadow) {
    if (h.budgetMinutes !== undefined) usedMinutes += h.budgetMinutes;
    else {
      // 단위 3-E2 전의 그림자 기록: 보스는 언제나 1페이즈였다
      const o = owner.get(h.problemId);
      if (o) usedMinutes += shadowMinutes(o, false);
    }
  }
  // 오늘 이전에 처치했는가(solvedAt이 없는 옛 기록은 오늘 이전으로 본다)
  const solvedBefore = (id: string) => {
    const r = save.problems[id];
    return r?.solved === true && (!r.solvedAt || dayOf(r.solvedAt) < today);
  };

  const ordered: ShadowPlanItem[] = [];
  const pending: ShadowPending[] = [];
  for (const entry of shadowCandidates(save, now)) {
    const rep = problems.find((p) => p.id === entry.problemId) ?? problems.find((p) => p.concept === entry.concept);
    if (!rep) continue;
    const anonymous = entry.box >= SHADOW_ANON_BOX;
    const base = boardShadow(entry, today);
    if (!solvedBefore(rep.id)) {
      pending.push({ ...base, reason: save.problems[rep.id]?.solved ? "solvedToday" : "unsolved", anonymous });
      continue;
    }
    let original = rep;
    let twoPhase = false;
    if (anonymous) {
      const pool = problems.filter((p) => p.concept === entry.concept && solvedBefore(p.id));
      original = rotateOriginal(rep, pool, shadowBefore, owner);
      twoPhase = original.boss && !SHADOW_PHASE2_EXCLUDE.has(original.id);
    }
    ordered.push({
      ...base,
      original,
      problem: shadowProblem(original, before, { twoPhase, anonymous }),
      minutes: shadowMinutes(original, twoPhase),
      anonymous,
      twoPhase,
    });
  }

  const items: ShadowPlanItem[] = [];
  const maxItems = Math.max(0, DAILY_SHADOW_LIMIT - fought);
  let total = usedMinutes;
  for (const it of ordered) {
    if (items.length >= maxItems) break;
    const firstOfDay = fought === 0 && items.length === 0;
    if (!firstOfDay && total + it.minutes > DAILY_SHADOW_MINUTES) break;
    items.push(it);
    total += it.minutes;
  }
  return {
    items,
    pending,
    usedMinutes,
    plannedMinutes: items.reduce((n, it) => n + it.minutes, 0),
    fought,
    deferred: ordered.length - items.length,
  };
}

// ───────────── 그림자전에 낼 문제 ─────────────

export interface ShadowProblemOptions {
  /** 원래 보스의 2페이즈 테스트·phases·budgetUnits를 변형 1페이즈 뒤에 붙인다(보스일 때만 뜻이 있다) */
  twoPhase?: boolean;
  /** 적 이름·제목을 '이름 없는 그림자'로 감춘다 */
  anonymous?: boolean;
}

/**
 * 그림자전에 낼 문제. 그 원래 문제의 변형을 순서대로 돌려 쓰되 마지막으로 낸 것은 피한다(기록의 problemId로 안다).
 * 변형이 없으면 원래 문제. 보스는 1페이즈만(opts.twoPhase면 원래 보스의 2페이즈까지), 보상은 그림자 기준으로 맞춘다
 */
export function shadowProblem(original: Problem, history: SaveData["history"], opts: ShadowProblemOptions = {}): Problem {
  const idx = nextShadowVariantIndex(original, history);
  let out = idx < 0 ? plain(original) : variantProblem(original, original.variants![idx]);
  if (opts.twoPhase && original.boss) out = withPhase2(out, original);
  if (opts.anonymous) out = { ...out, title: SHADOW_ANON_NAME, enemy: { ...out.enemy, name: SHADOW_ANON_NAME } };
  return out;
}

/**
 * 그 원래 문제로 그림자전에 다음에 낼 변형의 위치(변형이 없으면 -1): 그 문제의 변형으로 낸 마지막 그림자 기록의 다음.
 * 연습 전투(src/systems/practice.ts)가 이 변형을 피한다
 */
export function nextShadowVariantIndex(original: Problem, history: SaveData["history"]): number {
  const variants = original.variants ?? [];
  if (variants.length === 0) return -1;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h.shadow || h.concept !== original.concept) continue;
    const at = variants.findIndex((v) => v.id === h.problemId);
    if (at >= 0) return (at + 1) % variants.length;
  }
  return 0;
}

/**
 * 변형 하나 → 전투에 낼 문제(그림자전과 연습 전투가 같이 쓴다, 단위 3-E3). 이야기·입력값만 바꾸고 형식·시그니처·힌트·적은 원래 문제 것.
 * 보스 변형은 1페이즈만이므로 시간 결계(페이즈·예산)를 떼고 boss: false
 */
export function variantProblem(original: Problem, v: ProblemVariant): Problem {
  return {
    ...plain(original),
    id: v.id,
    title: v.title,
    statement: v.statement,
    tests: v.tests,
  };
}

/** 보스 그림자 2페이즈: 원래 보스의 2페이즈 이후 테스트(같은 객체, 생성기 캐시를 함께 쓴다)·phases·budgetUnits를 붙인다 */
function withPhase2(base: Problem, original: Problem): Problem {
  const later = original.tests.filter((t) => (t.phase ?? 1) >= 2);
  const statement = `${base.statement.trimEnd()}\n\n${SHADOW_PHASE2_NOTE}\n`;
  const out: Problem = { ...base, boss: true, tests: [...base.tests, ...later], statement };
  if (original.phases?.length) {
    out.phases = original.phases.map((ph): BossPhase => {
      // 원래 보스의 대사는 이름·풀이 방향을 말할 수 있으므로 쓰지 않는다
      const copy: BossPhase = { ...ph };
      delete copy.intro;
      if (ph.phase >= 2) copy.intro = SHADOW_PHASE2_INTRO;
      return copy;
    });
  }
  if (original.budgetUnits !== undefined) out.budgetUnits = original.budgetUnits;
  return out;
}

/**
 * 전투용 사본의 공통 정리: 보스는 1페이즈만(boss: false, 시간 결계 없음), 중간 보스·연습·응용 표시와 변형 목록을 뗀다.
 * 보상은 그림자 기준(§7.1): 보스(최종·중간)는 일반 전투 보상(100 XP·50골드)을 기준으로 하고, 그 밖은 원래 보상(응용 전투 포함).
 * 그림자 비율 50%는 보상 계산(rewards.ts)이 곱한다. 연습 전투는 보상이 없으므로 영향 없음
 */
function plain(p: Problem): Problem {
  const out: Problem = {
    ...p,
    boss: false,
    tests: p.boss ? p.tests.filter((t) => (t.phase ?? 1) === 1) : p.tests,
    reward: p.boss ? { ...SHADOW_BOSS_BASE_REWARD } : p.reward,
  };
  // 중간 보스도 그림자전에서는 보스가 아니다(midBoss는 boss일 때만 뜻이 있다)
  delete out.midBoss;
  delete out.phases;
  delete out.budgetUnits;
  delete out.variants;
  delete out.practice;
  delete out.applied;
  return out;
}
