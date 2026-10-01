// 앱 계층: 월드·UI·실행기·진행 규칙·저장을 연결한다(design.md §4 게임 루프).
// 월드는 그리기와 입력만, UI는 화면만, 규칙은 src/systems의 순수 함수가 맡고, 여기서는 순서만 정한다.
import type { DialogueLine, GameContent, Lesson, Problem, Region } from "../contracts/content";
import type { BattleOutcome, Facing, SaveData } from "../contracts/state";
import type { BattleProgress, NameContext, UiServices } from "../contracts/ui";
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
import { arrivalSpot } from "./travel";

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
  /** start()가 끝나기 전(맵·저장 준비 중)에는 월드 입력을 막는다 */
  private starting = true;
  /** 불러오기·초기화로 새로고침하는 중(이후로는 아무것도 저장하지 않고 입력도 다시 켜지 않는다) */
  private leaving = false;
  /**
   * 저장을 막은 이유. 저장 데이터를 읽지 못했을 때(손상·더 새로운 버전·저장소 없음) 새 게임이 원래 데이터를
   * 덮어쓰지 않도록 이번 실행에서는 저장하지 않는다(메뉴의 불러오기·처음부터는 그대로 동작)
   */
  private saveBlocked: string | null = null;
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
      this.saveBlocked = e instanceof Error ? e.message : String(e);
      return null;
    });
    this.region = content.regions.find((r) => r.id === (loaded?.location.regionId ?? "r01")) ?? content.regions[0];

    this.world = await this.deps.worldFactory.create(gameEl, {
      onInteract: (o) => this.guard(() => this.interact(o)),
      onTrigger: (o) => this.guard(() => this.trigger(o)),
      onMoved: (pos) => {
        this.save.location = { regionId: this.region.id, ...pos };
        this.scheduleSave(this.save);
      },
      onMenu: () => this.guard(() => this.openMenu()),
    });
    // 시작이 끝날 때까지 이동·상호작용을 막는다(준비 중의 이동이 저장 전 상태를 건드리지 않게)
    this.world.setInputEnabled(false);

    const removed = new Set(loaded?.removedObjects ?? []);
    if (loaded) {
      this.save = settleOnLoad(loaded, this.now()).save;
      this.save.location = takeLocationBackup(this.save) ?? this.save.location;
      // 프롤로그 트리거를 이미 지난 저장(합류 플래그가 생기기 전 버전 포함)이면 누리를 보인다
      if (this.save.flags[`trigger.${this.region.id}.t_prologue`]) this.save.flags[COMPANION_FLAG] = true;
      this.world.setCompanionVisible(this.save.flags[COMPANION_FLAG] === true);
      await this.world.loadRegion(this.region, this.save.location, removed);
      // 저장 위치가 설 수 없는 칸(맵이 바뀐 옛 저장, 고친 저장 파일)이면 월드가 가까운 빈 칸으로 옮긴다.
      // 가까운 칸은 아직 열지 않은 구역일 수 있으므로, 그때는 마지막 캠프파이어로 보낸다
      const at = this.world.getPlayerPosition();
      const c = this.save.lastCampfire;
      if ((at.x !== this.save.location.x || at.y !== this.save.location.y) && c.regionId === this.region.id) {
        this.world.teleport(c.x, c.y, "down");
      }
      this.save.location = { regionId: this.region.id, ...this.world.getPlayerPosition() };
    } else {
      // 새 게임: 맵을 먼저 그려서 spawn 위치를 알아낸 뒤 그 자리로 옮긴다
      await this.world.loadRegion(this.region, { x: 0, y: 0, facing: "down" }, removed);
      const spawn = this.world.getObjects().find((o) => o.type === "spawn");
      const at = { x: spawn?.x ?? 1, y: spawn?.y ?? 1, facing: "down" as const };
      this.save = createNewSave(this.now(), { spawn: at, regionId: this.region.id });
      this.world.teleport(at.x, at.y, at.facing);
    }

    const guarded = { save: (d: SaveData) => (this.saveBlocked ? Promise.resolve(d) : store.save(d)) };
    this.autosaver = createAutosaver(guarded, { delayMs: 800, onError: (e) => console.error("자동 저장 실패", e) });
    // 페이지를 떠날 때 IndexedDB 쓰기는 끝나기 전에 끊길 수 있어서, 아직 저장되지 않은 위치는 localStorage에도 남긴다
    const leave = () => {
      // 불러오기·초기화 뒤에는 옛 데이터를 다시 쓰면 안 된다
      if (this.leaving) return;
      if (this.autosaver.pending && !this.saveBlocked) writeLocationBackup(this.save);
      void this.autosaver.flush();
    };
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") leave();
    });
    addEventListener("pagehide", leave);

    try {
      await this.persist();
    } catch (e) {
      // 저장소 쓰기가 막혀도(용량 부족 등) 게임은 시작한다. 이후 저장 실패는 그때마다 알린다
      console.error("저장하지 못했습니다", e);
      this.deps.ui.hud.toast(`저장하지 못했어: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (this.saveBlocked) {
      this.deps.ui.hud.toast(`저장 데이터를 읽지 못했어(${this.saveBlocked}). 원래 데이터를 지키려고 이번 플레이는 저장하지 않아. 메뉴에서 불러오기나 처음부터를 고를 수 있어.`);
    }
    this.refreshHud();
    // 실행기는 처음 몇 초가 걸리므로 미리 부팅한다(13 MB, research.md §3.2.2)
    void this.deps.runner.init().catch((e) => console.error("실행기 부팅 실패", e));

    this.starting = false;
    this.world.setInputEnabled(true);
    // 지역 첫 대사는 기다리지 않는다(start는 화면 준비가 끝나면 바로 돌아온다)
    const intro = !this.save.flags[`region.${this.region.id}.intro`] ? this.guard(() => this.playRegionIntro()) : Promise.resolve();
    void intro.then(() => {
      // 보스를 쓰러뜨린 순간 저장했지만 클리어 연출 전에 페이지를 닫았으면 이어서 보여 준다
      const boss = this.region.problems.find((q) => q.boss);
      if (boss && this.save.problems[boss.id]?.solved && !this.save.flags[`region.${this.region.id}.clear`]) {
        return this.guard(() => this.clearRegion());
      }
    }).then(() => {
      // 트리거 대사 도중에 페이지를 닫았으면 그 칸에서 다시 시작하므로, 아직 발동하지 않은 once 트리거를 이어서 발동한다
      const o = this.pendingTriggerHere();
      if (o) void this.guard(() => this.trigger(o));
    });
  }

  /** 지역에 처음 들어왔을 때의 대사(한 번만) */
  private async playRegionIntro(): Promise<void> {
    const flag = `region.${this.region.id}.intro`;
    if (this.save.flags[flag]) return;
    this.save.flags[flag] = true;
    if (this.region.introDialogue) await this.say(this.region.introDialogue);
    await this.persist();
  }

  /** 지금 서 있는 칸의 아직 발동하지 않은 once 트리거 */
  private pendingTriggerHere(): MapObjectDef | undefined {
    const pos = this.world.getPlayerPosition();
    return this.world
      .getObjects()
      .find(
        (o) =>
          o.type === "trigger" && o.x === pos.x && o.y === pos.y && o.props.once && !this.save.flags[`trigger.${this.region.id}.${o.id}`],
      );
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
      case "warp":
        await this.warp(o);
        break;
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
    if (o.props.dialogue) await this.say(String(o.props.dialogue));
    // 대사를 끝까지 본 뒤에 표시한다(대사 도중의 자동 저장이 '본 것'으로 남기지 않도록)
    this.save.flags[flag] = true;
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

  // ───────────── 지역 간 이동 ─────────────

  /** warp: 조건을 만족하면 target 지역의 targetSpawn 옆으로 간다(docs/phase3/region02-spec.md §4) */
  private async warp(o: MapObjectDef): Promise<void> {
    const p = o.props;
    if (!checkRequires(p.requires as string | undefined, this.save).ok) {
      await this.say(String(p.lockedDialogue ?? ""));
      return;
    }
    const target = p.target ? this.deps.content.regions.find((r) => r.id === String(p.target)) : undefined;
    // 아직 없는 지역이면 openDialogue만 보여 주고 머문다
    if (!target) {
      await this.say(String(p.openDialogue ?? ""));
      return;
    }
    const flag = `warp.${this.region.id}.${o.id}`;
    if (!this.save.flags[flag]) {
      if (p.openDialogue) await this.say(String(p.openDialogue));
      this.save.flags[flag] = true;
    }
    const removed = new Set(this.save.removedObjects);
    const at = arrivalSpot(target, String(p.targetSpawn ?? ""), removed);
    if (!at) console.warn(`도착 칸 없음: ${target.id}/${String(p.targetSpawn)}`);
    await this.enterRegion(target, at);
  }

  /** 지역을 바꿔 그리고 플레이어를 놓는다(at이 없으면 spawn). 처음 들어온 지역이면 첫 대사, 도착 칸의 트리거까지 */
  private async enterRegion(region: Region, at: { x: number; y: number; facing: Facing } | null): Promise<void> {
    this.region = region;
    this.world.setCompanionVisible(this.save.flags[COMPANION_FLAG] === true);
    await this.world.loadRegion(region, at ?? { x: 0, y: 0, facing: "down" }, new Set(this.save.removedObjects));
    if (!at) {
      const spawn = this.world.getObjects().find((o) => o.type === "spawn");
      this.world.teleport(spawn?.x ?? 1, spawn?.y ?? 1, "down");
    }
    this.save.location = { regionId: region.id, ...this.world.getPlayerPosition() };
    await this.persist();
    this.refreshHud();
    await this.playRegionIntro();
    const o = this.pendingTriggerHere();
    if (o) await this.trigger(o);
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
    // 전투 도중의 자동 저장: 힌트·해설서·반격이 있었으면 '지금 후퇴(HP 0이면 쓰러짐)했다면'의 결과를 저장한다.
    // 그러지 않으면 새로고침으로 힌트 대가·해설서(보상 0)·쓰러짐 기록을 지울 수 있다(§5.3, §7.6)
    let progress: BattleProgress | null = null;
    // AC 순간에 저장한 승리(배너를 누르기 전 새로고침 대비). 있으면 전투가 끝난 뒤 다시 적용하지 않는다
    let won: ReturnType<typeof applyBattleOutcome> | null = null;
    const saveDuringBattle = (now: boolean) => {
      let data = this.save;
      if (progress && !won) {
        const provisional: BattleOutcome = {
          problemId: problem.id,
          result: progress.hp <= 0 ? "knockout" : "retreat",
          attempts: progress.attempts,
          maxHintLevel: progress.maxHintLevel,
          solutionViewed: progress.solutionViewed,
          finalCode: this.save.problems[problem.id]?.draft ?? problem.starter,
          hpLeft: progress.hp,
          elapsedMs: 0,
        };
        data = applyBattleOutcome(this.save, problem, provisional, this.now()).save;
      }
      this.scheduleSave(data);
      if (now) void this.autosaver.flush();
    };
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
        saveDuringBattle(false);
      },
      onProgress: (p) => {
        if (won) return;
        progress = { ...p };
        saveDuringBattle(true);
      },
      onVictory: (v) => {
        if (won) return;
        won = this.applyBattle(problem, o, v);
        this.persist().catch((e) => console.error("승리 저장 실패", e));
      },
      companionLines: {
        fatalRecursion: this.deps.content.commonDialogues.fatal_recursion,
        practiceSuggest: this.deps.content.commonDialogues.practice_suggest,
      },
    });
    let result: ReturnType<typeof applyBattleOutcome>;
    if (won && outcome.result === "victory") {
      result = won;
      // 배너를 누르는 사이에 바뀐 작성 코드만 반영한다(보상·기록은 이미 적용됨)
      const r = this.save.problems[problem.id];
      if (r) r.draft = outcome.finalCode;
    } else {
      result = this.applyBattle(problem, o, outcome);
    }
    await this.persist();
    this.refreshHud();
    await this.afterBattle(problem, o, result.events, result.summary);
  }

  /** 전투 결과를 저장 데이터에 적용한다(저장은 부르는 쪽에서) */
  private applyBattle(problem: Problem, o: MapObjectDef, outcome: BattleOutcome): ReturnType<typeof applyBattleOutcome> {
    const result = applyBattleOutcome(this.save, problem, outcome, this.now());
    this.save = result.save;
    if (outcome.result === "victory" && !this.save.removedObjects.includes(o.id)) this.save.removedObjects.push(o.id);
    return result;
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
        case "knockout": {
          await this.sayCommon("knockout");
          // 마지막 캠프파이어가 다른 지역이면 그 지역으로 돌아간다
          const home = e.respawn.regionId !== this.region.id ? this.deps.content.regions.find((r) => r.id === e.respawn.regionId) : undefined;
          if (home) await this.enterRegion(home, { x: e.respawn.x, y: e.respawn.y, facing: "down" });
          else this.world.teleport(e.respawn.x, e.respawn.y, "down");
          break;
        }
        case "retreat": {
          // 몬스터를 등지게 돌려세운다(바로 Space를 눌러 다시 붙지 않도록)
          const pos = this.world.getPlayerPosition();
          this.world.teleport(pos.x, pos.y, OPPOSITE[pos.facing]);
          this.save.location = { regionId: this.region.id, x: pos.x, y: pos.y, facing: OPPOSITE[pos.facing] };
          this.scheduleSave(this.save);
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
        try {
          // 진행 중인 자동 저장이 지운 뒤에 끝나서 옛 데이터를 되살리지 않도록 기다린다
          await this.autosaver.flush();
          await this.deps.store.clear();
        } catch (e) {
          this.leaving = false;
          throw e;
        }
        location.reload();
      },
    });
  }

  /** 저장 데이터를 통째로 바꾼다(불러오기). 화면에 반영하려면 새로고침 */
  async overwriteSave(data: SaveData): Promise<SaveData> {
    this.leaving = true;
    clearLocationBackup();
    this.autosaver.cancel();
    try {
      await this.autosaver.flush();
      this.save = await this.deps.store.save(data);
    } catch (e) {
      // 저장하지 못했으면 계속 플레이할 수 있게 되돌린다
      this.leaving = false;
      throw e;
    }
    return this.save;
  }

  // ───────────── 도우미 ─────────────

  /** 대화·전투·메뉴가 열려 있는 동안 월드 입력을 끄고, 겹쳐 열리지 않게 한다 */
  private async guard(fn: () => Promise<void>): Promise<void> {
    if (this.busyFlag || this.starting) return;
    this.busyFlag = true;
    this.world?.setInputEnabled(false);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      this.deps.ui.hud.toast("문제가 생겼어. 콘솔을 확인해 줘.");
    } finally {
      // 불러오기·초기화로 새로고침하는 중에는 입력을 다시 켜지 않는다(움직이면 옛 데이터가 자동 저장된다)
      if (!this.leaving) {
        this.busyFlag = false;
        this.world?.setInputEnabled(true);
      }
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

  /** 자동 저장 예약. 새로고침 중이거나 저장이 막혀 있으면 아무것도 하지 않는다 */
  private scheduleSave(data: SaveData): void {
    if (this.leaving || !this.autosaver) return;
    this.autosaver.schedule(data);
  }

  /** 지금 바로 저장. 진행 중인 자동 저장 뒤에 이어서 쓰므로 늦게 끝난 옛 자동 저장에 덮이지 않는다 */
  private async persist(): Promise<void> {
    if (this.leaving) return;
    this.save = await this.autosaver.saveNow(this.save);
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
