// 월드(Phaser) 계약. 구현은 src/game/.
// 월드는 그리기·이동·충돌·상호작용 감지만 맡고, 게임 규칙(전투 시작 여부, 문 열림 조건 등)은
// 앱 계층(src/app/)이 콜백을 받아 판단한다.
import type { Region } from "./content";
import type { Facing } from "./state";

export type MapObjectType =
  | "npc"       // props: dialogue, sprite, (lesson)
  | "sign"      // props: dialogue
  | "chest"     // props: gold?, item?, dialogue?
  | "door"      // props: requires(문제 ID 또는 플래그), lockedDialogue
  | "monster"   // props: problem
  | "campfire"  // props: (없음)
  | "rune"      // 레슨 비석. props: lesson
  | "trigger"   // 밟으면 발동. props: dialogue?, lesson?, once(boolean), joinCompanion?(대사 뒤 보조 캐릭터 합류)
  | "warp"      // props: requires, lockedDialogue, openDialogue, target(지역 ID)?, targetSpawn(도착 지역의 오브젝트 ID)?
  | "spawn";    // 새 게임 시작 위치(보이지 않음)

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
}

export interface WorldFactory {
  /** parent 요소 안에 Phaser 게임을 만든다 */
  create(parent: HTMLElement, callbacks: WorldCallbacks): Promise<WorldController>;
}
