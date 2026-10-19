// 월드(Phaser) 계약. 구현은 src/game/.
// 월드는 그리기·이동·충돌·상호작용 감지만 맡고, 게임 규칙(전투 시작 여부, 문 열림 조건 등)은
// 앱 계층(src/app/)이 콜백을 받아 판단한다.
import type { Region } from "./content";
import type { Facing } from "./state";

export type MapObjectType =
  | "npc"       // props: dialogue, sprite, (lesson)
  | "sign"      // props: dialogue
  | "chest"     // props: gold?, item?(items.json의 아이템 ID. 이미 가진 장신구·꾸미기면 주지 않음), dialogue?
  | "door"      // props: requires(문제 ID 또는 플래그), lockedDialogue
  | "monster"   // props: problem
  | "campfire"  // props: (없음)
  | "rune"      // 레슨 비석. props: lesson
  | "trigger"   // 밟으면 발동. props: dialogue?, lesson?, once(boolean), joinCompanion?(대사 뒤 보조 캐릭터 합류)
  | "warp"      // props: requires, lockedDialogue, openDialogue, target(지역 ID)?, targetSpawn(도착 지역의 오브젝트 ID)?
  | "spawn"     // 새 게임 시작 위치(보이지 않음)
  | "board"     // 그림자 게시판 + 일일 퀘스트 + 스트릭(§7.5, §7.6). props: (없음)
  | "shop";     // 상점(§7.2). props: (없음)

export interface MapObjectDef {
  /** 맵 안에서 고유. 저장 데이터 removedObjects에 쓰인다 */
  id: string;
  type: MapObjectType;
  /** 타일 좌표 */
  x: number;
  y: number;
  props: Record<string, string | number | boolean>;
}

export interface WorldCallbacks {
  /** 플레이어가 오브젝트를 바라보고 상호작용 키(Space/Enter/Z)를 눌렀을 때. 몬스터는 접촉 시에도 호출 */
  onInteract(object: MapObjectDef): void;
  /** trigger 오브젝트를 밟았을 때 */
  onTrigger(object: MapObjectDef): void;
  /** 한 칸 이동을 마칠 때마다 */
  onMoved(pos: { x: number; y: number; facing: Facing }): void;
  /** 메뉴 키(Esc/M) */
  onMenu(): void;
}

export interface WorldController {
  /** 지역 맵을 그린다. removed에 있는 오브젝트는 그리지 않는다 */
  loadRegion(region: Region, spawn: { x: number; y: number; facing: Facing }, removed: ReadonlySet<string>): Promise<void>;
  /** 처치한 몬스터·연 상자·열린 문을 맵에서 지운다(연출 포함 가능) */
  removeObject(id: string, effect?: "purify" | "open" | "none"): Promise<void>;
  /** 대화·전투·메뉴 중에는 false */
  setInputEnabled(enabled: boolean): void;
  getPlayerPosition(): { x: number; y: number; facing: Facing };
  teleport(x: number, y: number, facing: Facing): void;
  /** 보조 캐릭터(누리)를 보이고 따라오게 할지. 기본 false(프롤로그에서 합류) */
  setCompanionVisible(visible: boolean): void;
  /** 맵의 모든 오브젝트(제거된 것 포함) */
  getObjects(): MapObjectDef[];
  /** 꾸미기 아이템의 색(§7.2). null이면 원래 색. 구현이 없으면 무시 */
  setTint?(target: "player" | "companion", color: number | null): void;
  /** 화면 연출(색 보정·비네트·입자)을 켜고 끈다(성능 측정·디버그용). 구현이 없으면 무시 */
  setAmbienceEnabled?(on: boolean): void;
  /** 지금 그려지는 상태(애니메이션 프레임·연출). E2E·디버그용, 가볍다 */
  inspect?(): WorldInspect;
}

/** 캐릭터 시트 형식: 새 16×24 6열×4행 / 옛 16×16 가로 8프레임 */
export type CharacterSheetLayout = "grid6x4" | "legacy8";

export interface CharacterInspect {
  /** 시트의 프레임 번호 */
  frame: number;
  /** 새 시트 기준 열(0 서기, 1 왼발, 2 서기, 3 오른발, 4 숨쉬기, 5 깜빡임) */
  col: number;
  /** 몸을 올린 높이(px) */
  bob: number;
  facing: Facing;
  mode: "idle" | "walk" | "bump";
  layout: CharacterSheetLayout;
  depth: number;
  /** 스프라이트 위치(월드 px, 기준점 = 발 아래 가운데) */
  x: number;
  y: number;
}

export interface WorldInspect {
  player: CharacterInspect;
  nuri: CharacterInspect;
  /** 맵 위 캐릭터 NPC(오브젝트 ID → 상태) */
  npcs: Record<string, CharacterInspect>;
  /** 그 밖의 오브젝트 스프라이트(몬스터·보스·비석 등): 지금 프레임과 시트의 프레임 수 */
  objects: Record<string, { key: string; frame: number; frames: number; depth: number }>;
  /** 적용된 타일 애니메이션: 지금 보이는 타일 인덱스와 맵에서 그 타일이 칠해진 칸 수 */
  tileAnimations: { name: string; frames: number[]; current: number; cells: number }[];
  /** 경계 장식(결정 20): 겹친 레이어 수, 조각이 얹힌 칸 수, 조각 이름별 칸 수 */
  edges: { layers: number; cells: number; pieces: Record<string, number> };
  ambience: { grade: string; particles: string; particleCount: number; filters: boolean; enabled: boolean };
  /** Phaser가 잰 실제 FPS */
  fps: number;
  /** 카메라 왼쪽 위(월드 px)와 화면 크기(게임 px). 화면 좌표 = (월드 - 카메라) × 줌 */
  camera: { x: number; y: number; width: number; height: number };
}

/** 월드를 만들 때 고를 수 있는 것(전부 선택, 주로 테스트용) */
export interface WorldOptions {
  /** 이 스프라이트는 파일 대신 코드로 그린 새 형식 시험 시트를 쓴다(캐릭터 16×24 6열×4행, 그 밖 4프레임) */
  testSheets?: string[];
  /** manifest.tileAnimations 대신 쓸 타일 애니메이션 */
  tileAnimations?: Record<string, { frames: string[]; fps: number }>;
  /** false면 화면 연출을 끈 채로 시작 */
  ambience?: boolean;
  /** false면 경계 장식을 그리지 않는다(전후 비교용) */
  edgeDecor?: boolean;
}

export interface WorldFactory {
  /** parent 요소 안에 Phaser 게임을 만든다 */
  create(parent: HTMLElement, callbacks: WorldCallbacks, options?: WorldOptions): Promise<WorldController>;
}
