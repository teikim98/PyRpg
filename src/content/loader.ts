// 콘텐츠 로더(design.md §10, §11). content/ 아래 파일을 Vite import.meta.glob으로 묶어서
// src/contracts/content.ts의 런타임 타입으로 바꾼다. 문제 추가는 content/에 폴더를 만드는 것으로 끝난다.
import type {
  BossPhase,
  CompanionProfile,
  ProblemCompare,
  DiagnosisRule,
  DialogueMap,
  EnemyDef,
  GameContent,
  Lesson,
  Problem,
  ProblemKind,
  ProblemTest,
  RecommendedProblem,
  Region,
  Scroll,
  BlankExercise,
  TiledMap,
  TracebackRule,
} from "../contracts/content";

/** problem.json의 파일 형식. 코드·본문은 옆의 .py/.md 파일에 있다 */
export interface ProblemFile {
  id: string;
  title: string;
  kind: ProblemKind;
  entry?: string;
  enemy: EnemyDef;
  requires: string[];
  concept: string;
  boss: boolean;
  phases?: BossPhase[];
  practice?: boolean;
  timeLimitMs: number;
  budgetUnits?: number;
  /** 함수형 비교 옵션 */
  compare?: ProblemCompare;
  estimatedMinutes: number;
  tests: ProblemTest[];
  /** 정답으로 인정해야 하는 다른 답안(검증용, 예: 튜플 반환). 게임에는 담지 않는다 */
  accepted?: { file: string; title?: string }[];
  /** 오답 예시(검증용). diagnosis는 problem.diagnoses로 옮긴다 */
  wrong: { file: string; title?: string; slow?: boolean; expectFail: Record<string, string>; diagnosis: DiagnosisRule }[];
  /** 오답 예시와 묶이지 않은 진단 규칙. wrong[]의 진단보다 먼저 본다 */
  extraDiagnoses?: DiagnosisRule[];
  hints: [string, string, string];
  reward: { xp: number; gold: number };
}

export interface RegionFile {
  id: string;
  order: number;
  name: string;
  introDialogue?: string;
  clearDialogue?: string;
  recommended?: RecommendedProblem[];
}

export interface LessonFile {
  id: string;
  title: string;
  scroll: Scroll;
  exercise?: BlankExercise;
}

/** 경로 → 내용. 키는 "regions/r01-echo-village/problems/P0101/problem.json"처럼 content/ 기준 */
export interface ContentSources {
  json: Record<string, unknown>;
  text: Record<string, string>;
}

function rel(path: string): string {
  const i = path.indexOf("content/");
  return i >= 0 ? path.slice(i + "content/".length) : path;
}

function rekey<T>(mods: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(mods)) out[rel(k)] = v;
  return out;
}

/** Vite가 빌드 시점에 content/를 묶는다(dev·build·Vitest 모두 동작) */
export function collectSources(): ContentSources {
  const json = import.meta.glob(
    [
      "../../content/regions/*/region.json",
      "../../content/regions/*/dialogue.json",
      "../../content/regions/*/problems/*/problem.json",
      "../../content/regions/*/lessons/*/lesson.json",
      "../../content/common/dialogue.json",
      "../../content/companion/*.json",
    ],
    { eager: true, import: "default" },
  );
  const text = import.meta.glob<string>(
    [
      "../../content/regions/*/problems/*/*.md",
      "../../content/regions/*/problems/*/*.py",
      "../../content/regions/*/lessons/*/lesson.md",
      // 맵은 월드 담당이 만든다. 아직 없으면 빈 객체로 둔다
      "../../content/regions/*/map.tmj",
    ],
    { eager: true, query: "?raw", import: "default" },
  );
  return { json: rekey(json), text: rekey(text) };
}

class ContentError extends Error {
  constructor(path: string, msg: string) {
    super(`콘텐츠 오류 ${path}: ${msg}`);
  }
}

function need<T>(value: T | undefined, path: string, what: string): T {
  if (value === undefined || value === null) throw new ContentError(path, `${what} 없음`);
  return value;
}

function buildProblem(src: ContentSources, regionDir: string, regionId: string, dir: string): Problem {
  const base = `regions/${regionDir}/problems/${dir}/`;
  const p = need(src.json[`${base}problem.json`] as ProblemFile | undefined, base, "problem.json");
  for (const key of ["id", "title", "kind", "enemy", "requires", "concept", "tests", "hints", "reward"] as const) {
    need(p[key], `${base}problem.json`, key);
  }
  if (p.id !== dir) throw new ContentError(base, `id ${p.id}가 폴더 이름과 다름`);
  if (p.hints.length !== 3) throw new ContentError(base, "hints는 3개");
  const diagnoses: DiagnosisRule[] = [...(p.extraDiagnoses ?? []), ...(p.wrong ?? []).map((w) => w.diagnosis).filter(Boolean)];
  const problem: Problem = {
    id: p.id,
    regionId,
    title: p.title,
    kind: p.kind,
    enemy: p.enemy,
    requires: p.requires,
    boss: p.boss === true,
    concept: p.concept,
    timeLimitMs: p.timeLimitMs,
    estimatedMinutes: p.estimatedMinutes,
    tests: p.tests,
    statement: need(src.text[`${base}statement.md`], base, "statement.md"),
    starter: src.text[`${base}starter.py`] ?? "",
    solution: need(src.text[`${base}solution.py`], base, "solution.py"),
    explanation: src.text[`${base}explanation.md`] ?? "",
    hints: p.hints,
    diagnoses,
    reward: p.reward,
  };
  if (p.kind === "function") problem.entry = p.entry ?? "solution";
  if (p.phases) problem.phases = p.phases;
  if (p.practice) problem.practice = true;
  if (p.budgetUnits !== undefined) problem.budgetUnits = p.budgetUnits;
  if (p.compare) problem.compare = p.compare;
  return problem;
}

function buildLesson(src: ContentSources, regionDir: string, regionId: string, dir: string): Lesson {
  const base = `regions/${regionDir}/lessons/${dir}/`;
  const l = need(src.json[`${base}lesson.json`] as LessonFile | undefined, base, "lesson.json");
  if (l.id !== dir) throw new ContentError(base, `id ${l.id}가 폴더 이름과 다름`);
  need(l.scroll?.id, `${base}lesson.json`, "scroll.id");
  const lesson: Lesson = {
    id: l.id,
    regionId,
    title: l.title,
    scroll: l.scroll,
    body: need(src.text[`${base}lesson.md`], base, "lesson.md"),
  };
  if (l.exercise) lesson.exercise = l.exercise;
  return lesson;
}

/** 하위 폴더 이름 목록. 예: subdirs(keys, "regions/r01-echo-village/problems/") → ["P0101", ...] */
function subdirs(keys: string[], prefix: string): string[] {
  const set = new Set<string>();
  for (const k of keys) {
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash > 0) set.add(rest.slice(0, slash));
  }
  return [...set].sort();
}

function parseMap(raw: string | undefined, path: string): TiledMap {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TiledMap;
  } catch (e) {
    throw new ContentError(path, `맵 JSON 오류 ${(e as Error).message}`);
  }
}

export function buildContent(src: ContentSources): GameContent {
  const keys = [...Object.keys(src.json), ...Object.keys(src.text)];
  const regions: Region[] = [];
  for (const regionDir of subdirs(keys, "regions/")) {
    const base = `regions/${regionDir}/`;
    const r = need(src.json[`${base}region.json`] as RegionFile | undefined, base, "region.json");
    const problems = subdirs(keys, `${base}problems/`).map((d) => buildProblem(src, regionDir, r.id, d));
    const lessons = subdirs(keys, `${base}lessons/`).map((d) => buildLesson(src, regionDir, r.id, d));
    const region: Region = {
      id: r.id,
      order: r.order,
      name: r.name,
      map: parseMap(src.text[`${base}map.tmj`], `${base}map.tmj`),
      problems,
      lessons,
      dialogues: (src.json[`${base}dialogue.json`] as DialogueMap | undefined) ?? {},
      recommended: r.recommended ?? [],
    };
    if (r.introDialogue) region.introDialogue = r.introDialogue;
    if (r.clearDialogue) region.clearDialogue = r.clearDialogue;
    regions.push(region);
  }
  regions.sort((a, b) => a.order - b.order);
  return {
    regions,
    companion: need(src.json["companion/profile.json"] as CompanionProfile | undefined, "companion/", "profile.json"),
    traceback: (src.json["companion/traceback.json"] as TracebackRule[] | undefined) ?? [],
    commonDialogues: (src.json["common/dialogue.json"] as DialogueMap | undefined) ?? {},
  };
}

let cached: GameContent | undefined;

/** 게임 전체 콘텐츠. 처음 부를 때 한 번만 조립한다 */
export function loadContent(): GameContent {
  cached ??= buildContent(collectSources());
  return cached;
}
