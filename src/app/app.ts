// 앱 계층: 월드·UI·실행기·진행 규칙·저장을 연결한다(design.md §4 게임 루프).
// 월드는 그리기와 입력만, UI는 화면만, 규칙은 src/systems의 순수 함수가 맡고, 여기서는 순서만 정한다.
import type { DialogueLine, GameContent, ItemDef, Lesson, Problem, Region } from "../contracts/content";
import type { PythonRunner } from "../contracts/runner";
import type { BattleOutcome, Facing, SaveData } from "../contracts/state";
import type { BattleProgress, BoardView, EquipmentView, NameContext, QuestPanelView, ShopView, StreakView, TitlesView, UiServices } from "../contracts/ui";
import type { MapObjectDef, WorldController, WorldFactory } from "../contracts/world";
import { OPPOSITE } from "../game/grid";
import { diagnoseResult } from "../python/diagnose";
import { explainError } from "../python/explain";
import type { PythonRunnerHandle } from "../python/runner";
import { createAutosaver, exportSave, importSave, type Autosaver, type SaveStore } from "../state";
import { createNewSave } from "../state/newGame";
import {
  accessorySlots,
  applyBattleOutcome,
  applyQuestEvent,
  awardTitles,
  boardShadows,
  buyItem,
  completeLesson,
  currentStreak,
  DAILY_SHADOW_LIMIT,
  dueShadows,
  EMBER_THRESHOLD,
  emptyRecord,
  ensureDailyQuests,
  equipmentEffects,
  hudState,
  itemsRewardedBy,
  lastStreakRepair,
  levelFromXp,
  MAX_PROTECTIONS,
  maxHp,
  owned,
  purifiedShadows,
  questProgress,
  REPAIR_BATTLES,
  repairOffer,
  restAtCampfire,
  returnCleared,
  settleOnLoad,
  shadowProblem,
  shadowsFoughtToday,
  shopState,
  tintColor,
  TIME_BARRIER_FLAG,
  todayCount,
  toggleAccessory,
  toggleCosmetic,
  usePotion,
  waitingShadows,
  WEEK_GOAL,
  weekDays,
  type BattleEvent,
  type QuestEvent,
  type QuestContext,
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
  /** 전투·퀘스트·칭호 처리 중에 모은 알림(창이 닫힌 뒤 토스트로) */
  private notices: string[] = [];
  /** 퀘스트 보상으로 오른 레벨(알림을 띄울 때 레벨업 대사) */
  private pendingLevel: number | null = null;

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

    // 오늘의 퀘스트, 이미 이룬 칭호(옛 저장 포함), 꾸미기 색
    this.ensureQuests();
    this.checkTitles();
    this.applyTints();

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
    for (const n of this.notices.splice(0)) this.deps.ui.hud.toast(n);
    this.pendingLevel = null;
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
      case "board":
        await this.openBoard();
        break;
      case "shop":
        await this.openShop();
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
    const r = completeLesson(this.save, lesson, { maxHpBonus: this.hpBonus() });
    this.save = r.save;
    if (r.firstTime) this.questEvent({ type: "lesson" });
    await this.persist();
    this.refreshHud();
    if (r.firstTime) {
      this.deps.ui.hud.toast(`${lesson.scroll.name} 획득! (+${r.xp} XP)`);
      await this.say(`lesson_${lesson.id}_done`);
      if (r.levelAfter > r.levelBefore) await this.levelUp(r.levelAfter);
    }
    await this.flushNotices();
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
    this.save = restAtCampfire(this.save, { regionId: this.region.id, x: pos.x, y: pos.y }, { maxHpBonus: this.hpBonus() });
    this.questEvent({ type: "rest" });
    await this.persist();
    this.refreshHud();
    await this.sayCommon("campfire_rest");
    await this.flushNotices();
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
    await this.runBattle(problem, { object: o });
  }

  /** 그림자 게시판에서 고른 그림자와 싸운다(design.md §7.6). 변형 문제를 돌려 쓰고 보상은 50% */
  private async fightShadow(concept: string): Promise<void> {
    const entry = this.save.shadows.find((s) => s.concept === concept);
    if (!entry) return;
    const original = this.allProblems().find((p) => p.id === entry.problemId) ?? this.allProblems().find((p) => p.concept === concept);
    if (!original) {
      this.deps.ui.hud.toast("이 그림자의 문제를 찾지 못했어.");
      return;
    }
    await this.runBattle(shadowProblem(original, this.save.history), { shadow: true });
  }

  /** 전투 한 판: 전투 창 → 결과 적용 → 저장 → 보상·대사. object는 맵 몬스터(그림자전은 없음) */
  private async runBattle(problem: Problem, opts: { object?: MapObjectDef; shadow?: boolean }): Promise<void> {
    const shadow = opts.shadow === true;
    if (!this.deps.runner.isReady()) {
      this.deps.ui.hud.toast("마력을 모으는 중이야… 잠깐만!");
      await this.deps.runner.init();
    }
    const rec = shadow ? emptyRecord() : (this.save.problems[problem.id] ?? emptyRecord());
    if (!shadow) this.save.problems[problem.id] = rec;
    const level = levelFromXp(this.save.player.xp);
    const fx = this.effects();
    const potion = this.potionItem();
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
          finalCode: shadow ? "" : (this.save.problems[problem.id]?.draft ?? problem.starter),
          hpLeft: progress.hp,
          elapsedMs: 0,
        };
        data = applyBattleOutcome(this.save, problem, provisional, this.now(), { shadow, maxHpBonus: fx.maxHpBonus }).save;
      }
      this.scheduleSave(data);
      if (now) void this.autosaver.flush();
    };
    const outcome: BattleOutcome = await this.deps.ui.battle.open({
      problem,
      runner: this.deps.runner,
      companion: this.deps.content.companion,
      names: this.names,
      player: { hp: this.save.player.hp, maxHp: maxHp(level, fx.maxHpBonus) },
      draft: shadow ? undefined : rec.draft,
      knockouts: shadow ? 0 : rec.knockouts,
      hintLevel: shadow ? 0 : rec.maxHintLevel,
      regionOrder: this.regionOrderOf(problem),
      traceback: this.deps.content.traceback,
      explain: explainError,
      diagnose: diagnoseResult,
      onDraft: (code) => {
        // 그림자전의 코드는 남기지 않는다(다음에도 빈 상태에서 떠올려 보도록)
        if (shadow) return;
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
        won = this.applyBattle(problem, opts.object, v, shadow);
        this.persist().catch((e) => console.error("승리 저장 실패", e));
      },
      companionLines: {
        fatalRecursion: this.deps.content.commonDialogues.fatal_recursion,
        practiceSuggest: this.deps.content.commonDialogues.practice_suggest,
      },
      shadow,
      perks: {
        freeHint2: fx.guideFeather,
        targetComplexity: fx.targetComplexity ? problem.targetComplexity : undefined,
      },
      potions: potion ? { count: owned(this.save, potion.id), heal: potion.heal ?? 0, name: potion.name } : undefined,
      onUsePotion: () => {
        if (!potion) return;
        const next = usePotion(this.save, potion.id);
        if (next) this.save = next;
        saveDuringBattle(true);
      },
    });
    let result: ReturnType<typeof applyBattleOutcome>;
    if (won && outcome.result === "victory") {
      result = won;
      // 배너를 누르는 사이에 바뀐 작성 코드만 반영한다(보상·기록은 이미 적용됨)
      const r = this.save.problems[problem.id];
      if (r && !shadow) r.draft = outcome.finalCode;
    } else {
      result = this.applyBattle(problem, opts.object, outcome, shadow);
    }
    await this.persist();
    this.refreshHud();
    await this.afterBattle(problem, opts.object, result.events, result.summary, shadow);
    await this.flushNotices();
  }

  /** 전투 결과를 저장 데이터에 적용한다(저장은 부르는 쪽에서). 승리면 퀘스트·칭호·보상 아이템까지 */
  private applyBattle(problem: Problem, o: MapObjectDef | undefined, outcome: BattleOutcome, shadow = false): ReturnType<typeof applyBattleOutcome> {
    const result = applyBattleOutcome(this.save, problem, outcome, this.now(), { shadow, maxHpBonus: this.hpBonus() });
    this.save = result.save;
    if (outcome.result !== "victory") return result;
    if (o && !this.save.removedObjects.includes(o.id)) this.save.removedObjects.push(o.id);
    if (shadow) {
      this.questEvent({ type: "shadow" });
    } else {
      const rec = this.save.problems[problem.id];
      this.questEvent({ type: "win", maxHintLevel: rec?.maxHintLevel ?? outcome.maxHintLevel, attempts: rec?.attempts ?? outcome.attempts });
      if (outcome.timeBarrierFirstTry) this.save.flags[TIME_BARRIER_FLAG] = true;
      // 보스 보상 장신구(예: 지역 2 보스 → 길잡이 깃털)
      if (result.events.some((e) => e.type === "victory" && e.firstClear)) {
        for (const item of itemsRewardedBy(this.deps.content.items, problem.id)) {
          if (owned(this.save, item.id) > 0) continue;
          this.save.inventory[item.id] = 1;
          this.notices.push(`${item.name}을(를) 얻었다! 메뉴 > 장비에서 장착할 수 있어.`);
        }
      }
    }
    this.checkTitles();
    return result;
  }

  private async afterBattle(
    problem: Problem,
    o: MapObjectDef | undefined,
    events: BattleEvent[],
    summary: Parameters<UiServices["reward"]["show"]>[0],
    shadow = false,
  ): Promise<void> {
    const ui = this.deps.ui;
    for (const e of events) {
      if (e.type === "victory") {
        if (o) await this.world.removeObject(o.id, "purify");
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
          // 몬스터를 등지게 돌려세운다(바로 Space를 눌러 다시 붙지 않도록). 그림자전은 게시판 앞이라 그대로
          if (shadow) break;
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
    if (!shadow && problem.boss && events.some((e) => e.type === "victory")) await this.clearRegion();
  }

  private async clearRegion(): Promise<void> {
    const flag = `region.${this.region.id}.clear`;
    const first = !this.save.flags[flag];
    this.save.flags[flag] = true;
    // 지역 해방자 칭호(§7.4)
    this.checkTitles();
    await this.persist();
    if (!first) return;
    await this.say("boss_defeated");
    if (this.region.clearDialogue) await this.say(this.region.clearDialogue);
    await this.deps.ui.reward.showRecommended(this.region.name, this.region.recommended, this.deps.bojBaseUrl);
    await this.flushNotices();
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
        // 코덱스에서 예제를 실행했는지 본다(일일 퀘스트 '코덱스 레슨 다시 실행')
        let ran = false;
        const r = this.deps.runner;
        const tracked: PythonRunner = {
          init: () => r.init(),
          isReady: () => r.isReady(),
          run: async (req) => {
            const out = await r.run(req);
            ran = true;
            return out;
          },
          judge: (p, c, o) => r.judge(p, c, o),
          referenceMs: () => r.referenceMs(),
          dispose: () => r.dispose(),
        };
        const purified = purifiedShadows(this.save).map((e) => ({ concept: e.concept, name: this.conceptName(e.concept), returnCleared: returnCleared(e) }));
        await this.deps.ui.codex.open(lessons, tracked, this.names, { purified });
        if (ran) {
          this.questEvent({ type: "codexRun" });
          await this.persist();
          this.refreshHud();
          await this.flushNotices();
        }
      },
      openEquipment: () => this.openEquipment(),
      openTitles: () => this.openTitles(),
      openQuests: async () => {
        this.ensureQuests();
        this.refreshHud();
        await this.deps.ui.board.openQuests({ quests: this.questPanelView(), streak: this.streakView() });
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

  // ───────────── 그림자 게시판·상점·장비·칭호(design.md §7.2~§7.6) ─────────────

  private async openBoard(): Promise<void> {
    this.ensureQuests();
    this.refreshHud();
    const concept = await this.deps.ui.board.open(this.boardView(), this.names);
    if (concept) await this.fightShadow(concept);
  }

  boardView(): BoardView {
    const now = this.now();
    return {
      shadows: boardShadows(this.save, now).map((s) => ({
        concept: s.entry.concept,
        name: this.conceptName(s.entry.concept),
        box: s.entry.box,
        due: s.entry.due,
        overdueDays: s.overdueDays,
        nextIntervalDays: s.nextIntervalDays,
        returning: s.returning,
      })),
      waiting: waitingShadows(this.save, now),
      foughtToday: shadowsFoughtToday(this.save.history, now),
      dailyLimit: DAILY_SHADOW_LIMIT,
      quests: this.questPanelView(),
      streak: this.streakView(),
    };
  }

  private questPanelView(): QuestPanelView {
    const qc = this.deps.content.quests;
    const st = this.save.quests;
    const ids = st?.ids ?? [];
    return {
      date: st?.date ?? "",
      quests: ids.map((id, i) => {
        const q = qc.pool.find((d) => d.id === id);
        return { id, text: q?.text ?? id, progress: st!.progress[i] ?? 0, count: q?.count ?? 1, done: st!.claimed[i] === true };
      }),
      reward: qc.reward,
      chest: {
        gold: qc.chest.gold,
        items: Object.entries(qc.chest.items).map(([id, count]) => ({ name: this.item(id)?.name ?? id, count })),
        claimed: st?.chest === true,
      },
    };
  }

  private streakView(): StreakView {
    const now = this.now();
    const st = this.save.streak;
    const offer = repairOffer(st, now, lastStreakRepair(this.save.flags));
    const view: StreakView = {
      weekDays: weekDays(st, now),
      weekGoal: WEEK_GOAL,
      streak: currentStreak(st, now),
      embers: st.embers,
      iceRunes: st.iceRunes,
      maxProtections: MAX_PROTECTIONS,
      todayCount: todayCount(st, now),
      emberThreshold: EMBER_THRESHOLD,
    };
    if (offer) view.repair = { missedDays: offer.missedDays, previousStreak: offer.previousStreak, battlesLeft: Math.max(0, REPAIR_BATTLES - todayCount(st, now)) };
    return view;
  }

  private async openShop(): Promise<void> {
    await this.deps.ui.shop.open(
      () => this.shopView(),
      async (id) => {
        const item = this.item(id);
        if (!item) throw new Error("없는 물건이야");
        this.save = buyItem(this.save, item);
        await this.persist();
        this.refreshHud();
        if (item.kind === "accessory") return `${item.name}을(를) 샀어! 메뉴의 장비에서 장착해 봐.`;
        if (item.kind === "cosmetic") return `${item.name}을(를) 샀어! 메뉴의 장비 → 꾸미기에서 적용할 수 있어.`;
        if (item.kind === "iceRune") return `얼음 룬을 샀어! 빠진 날이 생기면 스트릭을 지켜 줄 거야.`;
        return `${item.name}을(를) 샀어! (보유 ${owned(this.save, item.id)})`;
      },
      this.names,
    );
  }

  shopView(): ShopView {
    const entries: ShopView["entries"] = [];
    for (const item of this.deps.content.items) {
      const state = shopState(this.save, item);
      if (!state) continue;
      entries.push({
        id: item.id,
        name: item.name,
        kind: item.kind,
        description: item.description,
        price: item.price!,
        state,
        minLevel: item.minLevel ?? 1,
        have: item.kind === "consumable" ? owned(this.save, item.id) : item.kind === "iceRune" ? this.save.streak.iceRunes : undefined,
        pending: item.pending,
        tint: item.tint,
      });
    }
    return { gold: this.save.player.gold, level: levelFromXp(this.save.player.xp), entries };
  }

  private async openEquipment(): Promise<void> {
    await this.deps.ui.equipment.open(() => this.equipmentView(), {
      toggleAccessory: async (id) => {
        const item = this.item(id);
        if (!item) throw new Error("없는 장신구야");
        const r = toggleAccessory(this.save, item);
        this.save = r.save;
        // 망토를 빼면 최대 HP가 줄어든다
        this.save.player.hp = Math.min(this.save.player.hp, maxHp(levelFromXp(this.save.player.xp), this.hpBonus()));
        await this.persist();
        this.refreshHud();
        return r.equipped ? `${item.name} 장착!` : `${item.name}을(를) 뺐어.`;
      },
      toggleCosmetic: async (id) => {
        const item = this.item(id);
        if (!item) throw new Error("없는 아이템이야");
        const r = toggleCosmetic(this.save, item);
        this.save = r.save;
        this.applyTints();
        await this.persist();
        return r.applied ? `${item.name} 적용!` : `원래 색으로 되돌렸어.`;
      },
    });
  }

  equipmentView(): EquipmentView {
    const level = levelFromXp(this.save.player.xp);
    const slots = accessorySlots(level);
    const items = this.deps.content.items;
    const view = (i: ItemDef) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      owned: owned(this.save, i.id) > 0,
      equipped: i.kind === "accessory" ? this.save.equipment.includes(i.id) : this.save.cosmetics?.[i.target ?? "player"] === i.id,
      pending: i.pending === true,
      source: i.source ?? (i.price !== undefined ? "상점" : undefined),
      tint: i.tint,
    });
    return {
      level,
      slots,
      nextSlotLevel: slots === 1 ? 10 : slots === 2 ? 20 : undefined,
      accessories: items.filter((i) => i.kind === "accessory").map(view),
      cosmetics: items.filter((i) => i.kind === "cosmetic" && owned(this.save, i.id) > 0).map((i) => ({ ...view(i), target: i.target ?? "player" })),
      consumables: items
        .filter((i) => i.kind === "consumable" && owned(this.save, i.id) > 0)
        .map((i) => ({ id: i.id, name: i.name, description: i.description, count: owned(this.save, i.id) })),
      maxHp: maxHp(level, this.hpBonus()),
    };
  }

  private async openTitles(): Promise<void> {
    await this.deps.ui.titles.open(
      () => this.titlesView(),
      async (id) => {
        if (id === null) delete this.save.activeTitle;
        else if (this.save.titles.includes(id)) this.save.activeTitle = id;
        await this.persist();
        this.refreshHud();
      },
    );
  }

  titlesView(): TitlesView {
    const now = this.now();
    return {
      playerName: this.save.player.name,
      level: levelFromXp(this.save.player.xp),
      streak: currentStreak(this.save.streak, now),
      weekDays: weekDays(this.save.streak, now),
      active: this.save.activeTitle,
      titles: this.deps.content.titles.map((t) => ({ id: t.id, name: t.name, description: t.description, earned: this.save.titles.includes(t.id) })),
    };
  }

  /** 오늘의 퀘스트가 없거나 날짜가 바뀌었으면 새로 뽑는다 */
  private ensureQuests(): void {
    if (this.deps.content.quests.pool.length === 0) return;
    this.save = ensureDailyQuests(this.save, this.deps.content.quests, this.now(), this.questContext());
  }

  private questContext(): QuestContext {
    const s = this.save;
    return {
      shadowDue: dueShadows(s, this.now()).length > 0,
      battleLeft: this.allProblems().some((p) => !p.practice && !s.problems[p.id]?.solved),
      lessonLeft: this.allLessons().some((l) => !s.lessonsCompleted.includes(l.id)),
      lessonDone: s.lessonsCompleted.length > 0,
    };
  }

  /** 퀘스트 사건 반영(보상은 바로, 알림은 나중에) */
  private questEvent(e: QuestEvent): void {
    this.ensureQuests();
    const r = applyQuestEvent(this.save, this.deps.content.quests, e);
    this.save = r.save;
    if (r.completed.length === 0) return;
    const reward = this.deps.content.quests.reward;
    for (const q of r.completed) this.notices.push(`퀘스트 완료: ${q.text} (+${reward.xp} XP, +${reward.gold} G)`);
    if (r.chest) {
      const items = Object.entries(r.chest.items).map(([id, n]) => `${this.item(id)?.name ?? id} ${n}개`);
      this.notices.push(`오늘의 퀘스트를 모두 끝냈어! 상자: 금화 ${r.chest.gold}${items.length ? ` + ${items.join(", ")}` : ""}`);
    }
    if (r.levelAfter > r.levelBefore) {
      this.save.player.hp = maxHp(r.levelAfter, this.hpBonus());
      this.pendingLevel = r.levelAfter;
    }
    this.checkTitles();
  }

  /** 새로 이룬 칭호를 준다 */
  private checkTitles(): void {
    const r = awardTitles(this.save, this.deps.content.titles, this.deps.content.regions);
    if (!r.earned.length) return;
    this.save = r.save;
    for (const t of r.earned) this.notices.push(`칭호 「${t.name}」를 얻었다! 메뉴의 칭호에서 달 수 있어.`);
  }

  /** 모아 둔 알림을 토스트로 보이고, 퀘스트로 오른 레벨이 있으면 레벨업 대사 */
  private async flushNotices(): Promise<void> {
    for (const n of this.notices.splice(0)) this.deps.ui.hud.toast(n);
    this.refreshHud();
    if (this.pendingLevel !== null) {
      const lv = this.pendingLevel;
      this.pendingLevel = null;
      await this.levelUp(lv);
    }
  }

  private applyTints(): void {
    const c = this.save.cosmetics ?? {};
    for (const target of ["player", "companion"] as const) {
      const id = c[target];
      this.world.setTint?.(target, id ? tintColor(this.item(id)?.tint) : null);
    }
  }

  private effects() {
    return equipmentEffects(this.save, this.deps.content.items);
  }

  private hpBonus(): number {
    return this.effects().maxHpBonus;
  }

  private item(id: string): ItemDef | undefined {
    return this.deps.content.items.find((i) => i.id === id);
  }

  private potionItem(): ItemDef | undefined {
    return this.deps.content.items.find((i) => i.kind === "consumable" && (i.heal ?? 0) > 0 && owned(this.save, i.id) > 0);
  }

  /** 개념(주문서 ID) → 주문서 이름 */
  private conceptName(concept: string): string {
    return this.allLessons().find((l) => l.scroll.id === concept)?.scroll.name ?? concept;
  }

  private allProblems(): Problem[] {
    return this.deps.content.regions.flatMap((r) => r.problems);
  }

  private regionOrderOf(problem: Problem): number {
    return this.deps.content.regions.find((r) => r.id === problem.regionId)?.order ?? this.region.order;
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
    const hud = hudState(this.save, this.now(), this.region.name, { maxHpBonus: this.hpBonus() });
    const title = this.deps.content.titles.find((t) => t.id === this.save.activeTitle);
    if (title) hud.title = title.name;
    const q = questProgress(this.save);
    if (q) hud.quests = q;
    this.deps.ui.hud.update(hud);
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
