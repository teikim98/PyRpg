// 앱 계층: 월드·UI·실행기·진행 규칙·저장을 연결한다(design.md §4 게임 루프).
// 월드는 그리기와 입력만, UI는 화면만, 규칙은 src/systems의 순수 함수가 맡고, 여기서는 순서만 정한다.
import type { DialogueLine, GameContent, Lesson, Problem, Region } from "../contracts/content";
import type { BattleOutcome, Facing, SaveData } from "../contracts/state";
import type { NameContext, UiServices } from "../contracts/ui";
import type { MapObjectDef, WorldController, WorldFactory } from "../contracts/world";
import { OPPOSITE } from "../game/grid";
import { diagnoseResult } from "../python/diagnose";
import { explainError } from "../python/explain";
import type { PythonRunnerHandle } from "../python/runner";
import { createAutosaver, exportSave, importSave, type Autosaver, type SaveStore } from "../state";
import { createNewSave } from "../state/newGame";
import {
  applyBattleOutcome,
  completeLesson,
  emptyRecord,
  hudState,
  levelFromXp,
  maxHp,
  restAtCampfire,
  settleOnLoad,
  type BattleEvent,
} from "../systems";
import { checkRequires, missingScrolls } from "./requires";

/** 보조 캐릭터가 합류했는지(프롤로그 트리거의 joinCompanion) */
export const COMPANION_FLAG = "companion.joined";

export interface AppDeps {
  content: GameContent;
  runner: PythonRunnerHandle;
  ui: UiServices;
  worldFactory: WorldFactory;
  store: SaveStore;
  /** 백준 재개 전에는 null(design.md §7.7) */
  bojBaseUrl: string | null;
  now?: () => Date;
}

export class App {
  save!: SaveData;
  world!: WorldController;
  region!: Region;
  private autosaver!: Autosaver;
  private busyFlag = false;
  /** 불러오기·초기화로 새로고침하는 중(떠날 때 위치 백업을 남기지 않는다) */
  private leaving = false;
  private readonly now: () => Date;

  constructor(private readonly deps: AppDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** 대화·전투·메뉴 등이 진행 중인가 */
  get busy(): boolean {
    return this.busyFlag;
  }

  get names(): NameContext {
    return { player: this.save.player.name, companion: this.deps.content.companion.name };
  }

  async start(gameEl: HTMLElement): Promise<void> {
    const { content, store } = this.deps;
    const loaded = await store.load().catch((e) => {
      console.error("저장 데이터를 읽지 못했습니다", e);
      this.deps.ui.hud.toast("저장 데이터를 읽지 못해 새 게임으로 시작합니다.");
      return null;
    });
    const isNew = !loaded;
    this.region = content.regions.find((r) => r.id === (loaded?.location.regionId ?? "r01")) ?? content.regions[0];

    this.world = await this.deps.worldFactory.create(gameEl, {
      onInteract: (o) => this.guard(() => this.interact(o)),
      onTrigger: (o) => this.guard(() => this.trigger(o)),
      onMoved: (pos) => {
        this.save.location = { regionId: this.region.id, ...pos };
        this.autosaver.schedule(this.save);
      },
      onMenu: () => this.guard(() => this.openMenu()),
    });

    const removed = new Set(loaded?.removedObjects ?? []);
    if (loaded) {
      this.save = settleOnLoad(loaded, this.now()).save;
      this.save.location = takeLocationBackup(this.save) ?? this.save.location;
      // 프롤로그 트리거를 이미 지난 저장(합류 플래그가 생기기 전 버전 포함)이면 누리를 보인다
      if (this.save.flags[`trigger.${this.region.id}.t_prologue`]) this.save.flags[COMPANION_FLAG] = true;
      this.world.setCompanionVisible(this.save.flags[COMPANION_FLAG] === true);
      await this.world.loadRegion(this.region, this.save.location, removed);
    } else {
      // 새 게임: 맵을 먼저 그려서 spawn 위치를 알아낸 뒤 그 자리로 옮긴다
      await this.world.loadRegion(this.region, { x: 0, y: 0, facing: "down" }, removed);
      const spawn = this.world.getObjects().find((o) => o.type === "spawn");
      const at = { x: spawn?.x ?? 1, y: spawn?.y ?? 1, facing: "down" as const };
      this.save = createNewSave(this.now(), { spawn: at, regionId: this.region.id });
      this.world.teleport(at.x, at.y, at.facing);
    }

    this.autosaver = createAutosaver(store, { delayMs: 800, onError: (e) => console.error("자동 저장 실패", e) });
    // 페이지를 떠날 때 IndexedDB 쓰기는 끝나기 전에 끊길 수 있어서, 아직 저장되지 않은 위치는 localStorage에도 남긴다
    const leave = () => {
      if (this.autosaver.pending && !this.leaving) writeLocationBackup(this.save);
      void this.autosaver.flush();
    };
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") leave();
    });
    addEventListener("pagehide", leave);

    await this.persist();
    this.refreshHud();
    // 실행기는 처음 몇 초가 걸리므로 미리 부팅한다(13 MB, research.md §3.2.2)
    void this.deps.runner.init().catch((e) => console.error("실행기 부팅 실패", e));

    // 지역 첫 대사는 기다리지 않는다(start는 화면 준비가 끝나면 바로 돌아온다)
    if (isNew || !this.save.flags[`region.${this.region.id}.intro`]) {
      void this.guard(async () => {
        this.save.flags[`region.${this.region.id}.intro`] = true;
        if (this.region.introDialogue) await this.say(this.region.introDialogue);
        await this.persist();
      });
    }
  }

  // ───────────── 상호작용 ─────────────

  private async interact(o: MapObjectDef): Promise<void> {
    const p = o.props;
    switch (o.type) {
      case "npc":
      case "sign":
        if (p.dialogue) await this.say(String(p.dialogue));
        if (p.lesson) await this.openLesson(String(p.lesson));
        break;
      case "rune":
        await this.openLesson(String(p.lesson));
        break;
      case "chest":
        await this.openChest(o);
        break;
      case "door":
        await this.openDoor(o);
        break;
      case "warp": {
        const check = checkRequires(p.requires as string | undefined, this.save);
        await this.say(String(check.ok ? p.openDialogue ?? "" : p.lockedDialogue ?? ""));
        break;
      }
      case "campfire":
        await this.rest();
        break;
      case "monster":
        await this.fight(o);
        break;
      default:
        break;
    }
  }

  private async trigger(o: MapObjectDef): Promise<void> {
    const flag = `trigger.${this.region.id}.${o.id}`;
    if (o.props.once && this.save.flags[flag]) return;
    this.save.flags[flag] = true;
    if (o.props.dialogue) await this.say(String(o.props.dialogue));
    if (o.props.joinCompanion) {
      this.save.flags[COMPANION_FLAG] = true;
      this.world.setCompanionVisible(true);
    }
    if (o.props.lesson) await this.openLesson(String(o.props.lesson));
    await this.persist();
  }

  private async openLesson(lessonId: string): Promise<void> {
    const lesson = this.findLesson(lessonId);
    if (!lesson) return;
    const first = !this.save.lessonsCompleted.includes(lesson.id);
    if (first) await this.say(`lesson_${lesson.id}_intro`);
    const { completed } = await this.deps.ui.lesson.open(lesson, this.deps.runner, this.names);
    if (!completed) return;
    const r = completeLesson(this.save, lesson);
    this.save = r.save;
    await this.persist();
    this.refreshHud();
    if (r.firstTime) {
      this.deps.ui.hud.toast(`${lesson.scroll.name} 획득! (+${r.xp} XP)`);
      await this.say(`lesson_${lesson.id}_done`);
      if (r.levelAfter > r.levelBefore) await this.levelUp(r.levelAfter);
    }
  }

  private async openChest(o: MapObjectDef): Promise<void> {
    if (this.save.removedObjects.includes(o.id)) return;
    const gold = Number(o.props.gold ?? 0);
    this.save.player.gold += gold;
    this.save.removedObjects.push(o.id);
    await this.world.removeObject(o.id, "open");
    if (o.props.dialogue) await this.say(String(o.props.dialogue));
    if (gold) this.deps.ui.hud.toast(`금화 ${gold}개를 얻었다!`);
    await this.persist();
    this.refreshHud();
  }

  private async openDoor(o: MapObjectDef): Promise<void> {
    const check = checkRequires(o.props.requires as string | undefined, this.save);
    if (!check.ok) {
      if (o.props.lockedDialogue) await this.say(String(o.props.lockedDialogue));
      return;
    }
    this.save.removedObjects.push(o.id);
    await this.world.removeObject(o.id, "open");
    await this.persist();
  }

  private async rest(): Promise<void> {
    const pos = this.world.getPlayerPosition();
    this.save = restAtCampfire(this.save, { regionId: this.region.id, x: pos.x, y: pos.y });
    await this.persist();
    this.refreshHud();
    await this.sayCommon("campfire_rest");
  }

  // ───────────── 전투 ─────────────

  private async fight(o: MapObjectDef): Promise<void> {
    const problem = this.region.problems.find((q) => q.id === String(o.props.problem));
    if (!problem || this.save.removedObjects.includes(o.id)) return;
    const missing = missingScrolls(problem.requires, this.save);
    if (missing.length) {
      await this.sayCommon("need_scroll");
      return;
    }
    if (!this.deps.runner.isReady()) {
      this.deps.ui.hud.toast("마력을 모으는 중이야… 잠깐만!");
      await this.deps.runner.init();
    }
    const rec = this.save.problems[problem.id] ?? emptyRecord();
    this.save.problems[problem.id] = rec;
    const level = levelFromXp(this.save.player.xp);
    const outcome: BattleOutcome = await this.deps.ui.battle.open({
      problem,
      runner: this.deps.runner,
      companion: this.deps.content.companion,
      names: this.names,
      player: { hp: this.save.player.hp, maxHp: maxHp(level) },
      draft: rec.draft,
      knockouts: rec.knockouts,
      hintLevel: rec.maxHintLevel,
      regionOrder: this.region.order,
      traceback: this.deps.content.traceback,
      explain: explainError,
      diagnose: diagnoseResult,
      onDraft: (code) => {
        this.save.problems[problem.id] = { ...(this.save.problems[problem.id] ?? emptyRecord()), draft: code };
        this.autosaver.schedule(this.save);
      },
    });
    const result = applyBattleOutcome(this.save, problem, outcome, this.now());
    this.save = result.save;
    if (outcome.result === "victory") {
      this.save.removedObjects.push(o.id);
    }
    await this.persist();
    this.refreshHud();
    await this.afterBattle(problem, o, result.events, result.summary);
  }

  private async afterBattle(problem: Problem, o: MapObjectDef, events: BattleEvent[], summary: Parameters<UiServices["reward"]["show"]>[0]): Promise<void> {
    const ui = this.deps.ui;
    for (const e of events) {
      if (e.type === "victory") {
        await this.world.removeObject(o.id, "purify");
        await ui.reward.show(summary, problem);
      }
    }
    for (const e of events) {
      switch (e.type) {
        case "knockout":
          await this.sayCommon("knockout");
          this.world.teleport(e.respawn.x, e.respawn.y, "down");
          break;
        case "retreat": {
          // 몬스터를 등지게 돌려세운다(바로 Space를 눌러 다시 붙지 않도록)
          const pos = this.world.getPlayerPosition();
          this.world.teleport(pos.x, pos.y, OPPOSITE[pos.facing]);
          this.save.location = { regionId: this.region.id, x: pos.x, y: pos.y, facing: OPPOSITE[pos.facing] };
          this.autosaver.schedule(this.save);
          await this.sayCommon("retreat");
          break;
        }
        case "solutionUnlocked":
          await this.sayCommon("solution_unlocked");
          break;
        case "levelUp":
          await this.levelUp(e.to);
          break;
        case "shadowRegistered":
          if (e.change === "created") await this.sayCommon("shadow_registered");
          break;
        default:
          break;
      }
    }
    if (problem.boss && events.some((e) => e.type === "victory")) await this.clearRegion();
  }

  private async clearRegion(): Promise<void> {
    const flag = `region.${this.region.id}.clear`;
    const first = !this.save.flags[flag];
    this.save.flags[flag] = true;
    await this.persist();
    if (!first) return;
    await this.say("boss_defeated");
    if (this.region.clearDialogue) await this.say(this.region.clearDialogue);
    await this.deps.ui.reward.showRecommended(this.region.name, this.region.recommended, this.deps.bojBaseUrl);
  }

  private async levelUp(level: number): Promise<void> {
    this.deps.ui.hud.toast(`레벨 ${level}!`);
    await this.sayCommon("level_up");
  }

  // ───────────── 메뉴 ─────────────

  private async openMenu(): Promise<void> {
    await this.deps.ui.menu.open({
      openCodex: async () => {
        const lessons = this.allLessons().filter((l) => this.save.lessonsCompleted.includes(l.id));
        await this.deps.ui.codex.open(lessons, this.deps.runner, this.names);
      },
      exportSave: async () => {
        await this.autosaver.flush();
        const { text, filename } = exportSave(this.save, this.now());
        const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      importSave: async (file) => {
        await this.overwriteSave(importSave(await file.text()));
        location.reload();
      },
      resetSave: async () => {
        this.leaving = true;
        clearLocationBackup();
        this.autosaver.cancel();
        await this.deps.store.clear();
        location.reload();
      },
    });
  }

  /** 저장 데이터를 통째로 바꾼다(불러오기). 화면에 반영하려면 새로고침 */
  async overwriteSave(data: SaveData): Promise<SaveData> {
    this.leaving = true;
    clearLocationBackup();
    this.autosaver.cancel();
    this.save = await this.deps.store.save(data);
    return this.save;
  }

  // ───────────── 도우미 ─────────────

  /** 대화·전투·메뉴가 열려 있는 동안 월드 입력을 끄고, 겹쳐 열리지 않게 한다 */
  private async guard(fn: () => Promise<void>): Promise<void> {
    if (this.busyFlag) return;
    this.busyFlag = true;
    this.world?.setInputEnabled(false);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      this.deps.ui.hud.toast("문제가 생겼어. 콘솔을 확인해 줘.");
    } finally {
      this.busyFlag = false;
      this.world?.setInputEnabled(true);
    }
  }

  private dialogueLines(id: string): DialogueLine[] | undefined {
    return this.region.dialogues[id] ?? this.deps.content.commonDialogues[id];
  }

  private async say(id: string): Promise<void> {
    const lines = id ? this.dialogueLines(id) : undefined;
    if (!lines) {
      if (id) console.warn(`대사 없음: ${id}`);
      return;
    }
    await this.deps.ui.dialogue.play(lines, this.names);
  }

  private async sayCommon(id: string): Promise<void> {
    const lines = this.deps.content.commonDialogues[id];
    if (lines) await this.deps.ui.dialogue.play(lines, this.names);
  }

  private findLesson(id: string): Lesson | undefined {
    return this.allLessons().find((l) => l.id === id);
  }

  private allLessons(): Lesson[] {
    return this.deps.content.regions.flatMap((r) => r.lessons);
  }

  private refreshHud(): void {
    this.deps.ui.hud.update(hudState(this.save, this.now(), this.region.name));
  }

  private async persist(): Promise<void> {
    this.autosaver?.cancel();
    this.save = await this.deps.store.save(this.save);
  }
}

// ───────────── 떠날 때의 위치 백업 ─────────────

const LOCATION_BACKUP_KEY = "pyrpg.locationBackup";

function writeLocationBackup(save: SaveData): void {
  try {
    localStorage.setItem(LOCATION_BACKUP_KEY, JSON.stringify({ ...save.location, at: new Date().toISOString() }));
  } catch {
    // 저장소를 쓸 수 없으면 IndexedDB 저장에만 맡긴다
  }
}

function clearLocationBackup(): void {
  try {
    localStorage.removeItem(LOCATION_BACKUP_KEY);
  } catch {
    // 무시
  }
}

/** 마지막 IndexedDB 저장보다 나중에 남긴 위치 백업이 있으면 그 위치(한 번 쓰면 지운다) */
export function takeLocationBackup(save: SaveData): SaveData["location"] | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCATION_BACKUP_KEY);
  } catch {
    return null;
  }
  clearLocationBackup();
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as Partial<SaveData["location"]> & { at?: string };
    const facings = ["up", "down", "left", "right"];
    if (
      b.regionId !== save.location.regionId ||
      !Number.isInteger(b.x) ||
      !Number.isInteger(b.y) ||
      !facings.includes(String(b.facing)) ||
      !(Date.parse(String(b.at)) > Date.parse(save.updatedAt))
    ) {
      return null;
    }
    return { regionId: b.regionId, x: b.x!, y: b.y!, facing: b.facing as Facing };
  } catch {
    return null;
  }
}
