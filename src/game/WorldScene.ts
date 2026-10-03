// 탐험 월드 씬: 타일맵 그리기, 그리드 이동, 충돌, 상호작용 감지(design.md §5.1, §9.7).
// 게임 규칙(전투 시작 여부, 문 열림 조건 등)은 판단하지 않고 콜백으로 알리기만 한다.
import * as Phaser from "phaser";
import { manifest } from "../contracts/assets";
import type { Region } from "../contracts/content";
import type { Facing } from "../contracts/state";
import type { CharacterInspect, MapObjectDef, WorldCallbacks, WorldInspect, WorldOptions } from "../contracts/world";
import { resolveAmbience } from "./ambience";
import { AmbienceFx } from "./ambienceFx";
import { type AnimSample, CharacterAnimator, type SheetLayout, detectSheetLayout, sheetFrame } from "./charAnim";
import {
  DIRS,
  OPPOSITE,
  ObjectIndex,
  buildCollisionGrid,
  facingFromDelta,
  inBounds,
  isActivatableElement,
  isEditableElement,
  keyAction,
  overheadTileIndices,
} from "./grid";
import { makeSpriteCanvas, makeTilesetCanvas } from "./placeholders";
import { type PhaserTileAnimData, type ResolvedTileAnimation, countAnimatedCells, phaserTileData, resolveTileAnimations } from "./tileAnim";
import { type ParsedMap, parseTiledMap } from "./tiled";

/** 한 칸 이동 시간(ms) */
export const STEP_MS = 135;
const TILE = manifest.tileSize;
/** 몬스터·오브젝트 제자리 애니메이션: 2프레임이면 2fps, 4프레임이면 4fps(둘 다 한 주기 1초) */
const IDLE_CYCLE_MS = 1000;
const DEPTH_BASE = 10;
/** 지붕 등 캐릭터 위에 그리는 타일 레이어(캐릭터 10+y보다 위, 정화 연출 900·입자 950보다 아래) */
const OVERHEAD_DEPTH = 800;
const VALID_FACINGS: readonly Facing[] = ["up", "down", "left", "right"];

const tilesetKey = (name: string) => `tileset:${name}`;

/** 오브젝트 종류별 기본 스프라이트(논리 이름) */
const TYPE_SPRITE: Partial<Record<MapObjectDef["type"], string>> = {
  sign: "obj_sign",
  chest: "obj_chest",
  door: "obj_door",
  campfire: "obj_campfire",
  rune: "obj_rune",
  warp: "obj_door",
  board: "obj_board",
  shop: "obj_shop",
};
/** 닫힘/열림 두 프레임이라 제자리 애니메이션을 하지 않는 스프라이트 */
const STATIC_SPRITES = new Set(["obj_chest", "obj_door"]);

function isCharacterSprite(key: string): boolean {
  return key === "player" || key === "nuri" || key.startsWith("npc_");
}

interface Pos {
  x: number;
  y: number;
}

/** 걷는 캐릭터 스프라이트 하나(플레이어·누리·NPC) */
interface CharacterView {
  sprite: Phaser.GameObjects.Sprite;
  anim: CharacterAnimator;
  /** 마지막으로 그린 프레임·높이(같으면 다시 설정하지 않는다) */
  frame: number;
  bob: number;
}

/** 맵 위 NPC: 원래 바라보던 방향(말을 건 뒤 플레이어가 움직이면 돌아간다) */
interface NpcView extends CharacterView {
  home: Facing;
}

export class WorldScene extends Phaser.Scene {
  private callbacks: WorldCallbacks;
  private onReady: () => void;
  private failedLoads = new Set<string>();

  private region: Region | null = null;
  private parsed: ParsedMap | null = null;
  private grid: Uint8Array = new Uint8Array(0);
  private defs: MapObjectDef[] = [];
  private index = new ObjectIndex(1);
  private removed = new Set<string>();
  /** 제거 연출 중인 오브젝트(연출이 끝나면 지운다) */
  private removing = new Map<string, { promise: Promise<void>; cancel: () => void }>();
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;

  private player!: Phaser.GameObjects.Sprite;
  private nuri!: Phaser.GameObjects.Sprite;
  private playerView!: CharacterView;
  private nuriView!: CharacterView;
  private npcs = new Map<string, NpcView>();
  /** 말을 건 뒤 플레이어 쪽으로 돌아선 NPC */
  private turnedNpc: string | null = null;
  private fx!: AmbienceFx;
  private tileAnims: ResolvedTileAnimation[] = [];
  private tileAnimData: Record<number, PhaserTileAnimData> = {};
  private tileset: Phaser.Tilemaps.Tileset | null = null;
  private pos: Pos = { x: 0, y: 0 };
  private nuriPos: Pos = { x: 0, y: 0 };
  private facing: Facing = "down";
  private moving = false;
  private moveTweens: Phaser.Tweens.Tween[] = [];

  private inputEnabled = true;
  /** 누르고 있는 방향키(나중에 누른 것이 뒤) */
  private held: Facing[] = [];
  /** 짧게 눌렀다 뗀 키도 한 칸은 움직이도록 남겨 둔 방향 */
  private pendingDir: Facing | null = null;
  private pendingInteract = false;
  /** 몬스터에 부딪힌 상태로 키를 누르고 있을 때 같은 몬스터를 반복 호출하지 않도록 */
  private bumpLatch: string | null = null;
  /** 입력이 꺼진 동안 이동을 마친 칸(입력이 다시 켜지면 그 칸의 트리거를 발동) */
  private deferredTrigger: Pos | null = null;
  private detachDom: (() => void) | null = null;

  /** 실제로 있는 이미지 파일(null이면 전부 시도) */
  private available: ReadonlySet<string> | null;
  private options: WorldOptions;

  constructor(
    callbacks: WorldCallbacks,
    onReady: () => void,
    available: ReadonlySet<string> | null = null,
    options: WorldOptions = {},
  ) {
    super({ key: "world" });
    this.callbacks = callbacks;
    this.onReady = onReady;
    this.available = available;
    this.options = options;
  }

  // ── 로딩 ───────────────────────────────────────────────────────────
  preload(): void {
    const base = import.meta.env.BASE_URL ?? "/";
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => this.failedLoads.add(file.key));
    const has = (file: string) => !this.available || this.available.has(file);
    for (const [name, ts] of Object.entries(manifest.tilesets)) {
      if (has(ts.file)) this.load.image(tilesetKey(name), base + ts.file);
    }
    for (const [name, sp] of Object.entries(manifest.sprites)) {
      if (has(sp.file)) this.load.spritesheet(name, base + sp.file, { frameWidth: sp.frameWidth, frameHeight: sp.frameHeight });
    }
  }

  create(): void {
    for (const [name, ts] of Object.entries(manifest.tilesets)) {
      const key = tilesetKey(name);
      if (!this.textureOk(key, ts.columns * TILE, TILE)) {
        this.replaceTexture(key);
        this.textures.addCanvas(key, makeTilesetCanvas(ts.tiles, ts.columns, TILE));
      }
    }
    for (const name of Object.keys(manifest.sprites)) this.ensureSprite(name);
    for (const name of this.options.testSheets ?? []) if (!manifest.sprites[name]) this.ensureSprite(name);

    this.player = this.add.sprite(0, 0, "player", 0).setOrigin(0.5, 1).setVisible(false);
    this.nuri = this.add.sprite(0, 0, "nuri", 0).setOrigin(0.5, 1).setVisible(false);
    this.playerView = { sprite: this.player, anim: new CharacterAnimator("down", 0, 0), frame: -1, bob: 0 };
    // 누리는 반 박자(반 걸음) 어긋나게 걷는다
    this.nuriView = { sprite: this.nuri, anim: new CharacterAnimator("down", 3, 1), frame: -1, bob: 0 };
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor("#1b1f2a");
    this.fx = new AmbienceFx(this);
    if (this.options.ambience === false) this.fx.setEnabled(false);
    this.attachDomInput();
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.detachDom?.());
    this.game.events.once(Phaser.Core.Events.DESTROY, () => this.detachDom?.());
    this.onReady();
  }

  private textureOk(key: string, minW: number, minH: number): boolean {
    if (this.failedLoads.has(key) || !this.textures.exists(key)) return false;
    const src = this.textures.get(key).getSourceImage() as { width?: number; height?: number };
    return (src.width ?? 0) >= minW && (src.height ?? 0) >= minH;
  }

  private replaceTexture(key: string): void {
    if (this.textures.exists(key)) this.textures.remove(key);
  }

  /**
   * 스프라이트 텍스처가 없으면 자리 표시용으로 만들고, 애니메이션을 등록한다.
   * options.testSheets에 있으면 파일 대신 코드로 그린 새 형식 시트(캐릭터 16×24 6×4, 그 밖 4프레임)를 쓴다.
   */
  private ensureSprite(name: string): void {
    const big = name.startsWith("boss_") ? 32 : 16;
    const test = this.options.testSheets?.includes(name) ?? false;
    const def = test
      ? { frameWidth: big, frameHeight: isCharacterSprite(name) ? 24 : big }
      : (manifest.sprites[name] ?? { frameWidth: big, frameHeight: big });
    if (test || !this.textureOk(name, def.frameWidth, def.frameHeight) || this.textures.get(name).frameTotal <= 1) {
      this.replaceTexture(name);
      const { canvas, frames, columns } = makeSpriteCanvas(name, def.frameWidth, def.frameHeight, test ? 4 : 2);
      const tex = this.textures.addCanvas(name, canvas)!;
      for (let i = 0; i < frames; i++) {
        tex.add(i, 0, (i % columns) * def.frameWidth, Math.floor(i / columns) * def.frameHeight, def.frameWidth, def.frameHeight);
      }
      if (this.anims.exists(`${name}:idle`)) this.anims.remove(`${name}:idle`);
    }
    this.createAnims(name);
  }

  private frameCount(key: string): number {
    return Math.max(1, this.textures.get(key).frameTotal - 1);
  }

  /** 캐릭터 시트 형식(실제 텍스처의 프레임 크기·수로 판별) */
  private sheetLayout(key: string): SheetLayout {
    const tex = this.textures.get(key);
    const f = tex.get(0);
    return detectSheetLayout(f.width, f.height, this.frameCount(key));
  }

  /** 제자리 애니메이션 프레임 수: 4프레임 이상이면 4, 아니면 2(1프레임 시트는 같은 프레임 반복) */
  private idleFrames(key: string): number {
    return this.frameCount(key) >= 4 ? 4 : 2;
  }

  private createAnims(key: string): void {
    if (isCharacterSprite(key) || STATIC_SPRITES.has(key)) return;
    const k = `${key}:idle`;
    if (this.anims.exists(k)) return;
    const n = this.idleFrames(key);
    const count = this.frameCount(key);
    this.anims.create({
      key: k,
      frames: Array.from({ length: n }, (_, i) => ({ key, frame: i % count })),
      frameRate: (n * 1000) / IDLE_CYCLE_MS,
      repeat: -1,
    });
  }

  /** 캐릭터 스프라이트에 애니메이션 상태를 그린다(바뀐 경우만) */
  private drawCharacter(view: CharacterView, s: AnimSample): void {
    const key = view.sprite.texture.key;
    const frame = sheetFrame(this.sheetLayout(key), this.frameCount(key), s.facing, s.col);
    if (frame !== view.frame) {
      view.sprite.setFrame(frame);
      view.frame = frame;
      view.bob = -1;
    }
    if (s.bob !== view.bob) {
      // 기준점(발 아래)을 아래로 내리면 그림이 위로 올라간다. 위치·깊이·카메라는 그대로
      const h = view.sprite.frame.height || 1;
      view.sprite.setOrigin(0.5, (h + s.bob) / h);
      view.bob = s.bob;
    }
  }

  private characterInfo(view: CharacterView): CharacterInspect {
    const s = view.anim.sample(this.time.now);
    return {
      frame: view.frame,
      col: s.col,
      bob: view.bob,
      facing: view.anim.facing,
      mode: view.anim.state,
      layout: this.sheetLayout(view.sprite.texture.key),
      depth: view.sprite.depth,
      x: view.sprite.x,
      y: view.sprite.y,
    };
  }

  // ── 지역 ───────────────────────────────────────────────────────────
  loadRegion(region: Region, spawn: { x: number; y: number; facing: Facing }, removed: ReadonlySet<string>): void {
    this.clearRegion();
    const parsed = parseTiledMap(region.map, Object.keys(manifest.tilesets));
    const ts = manifest.tilesets[parsed.tileset];
    this.region = region;
    this.parsed = parsed;
    this.grid = buildCollisionGrid(parsed, ts);
    this.defs = parsed.objects;
    this.removed = new Set([...removed].filter((id) => this.defs.some((d) => d.id === id)));
    this.index = new ObjectIndex(parsed.width);

    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: parsed.width, height: parsed.height });
    const tileset = map.addTilesetImage(parsed.tileset, tilesetKey(parsed.tileset), TILE, TILE, 0, 0, 0);
    if (!tileset) throw new Error(`tileset ${parsed.tileset} could not be created`);
    this.tilemap = map;
    this.tileset = tileset;
    this.setupTileAnimations(tileset, ts.tiles);
    for (const [name, data, depth] of [["ground", parsed.ground, 0], ["deco", parsed.deco, 1]] as const) {
      const layer = map.createBlankLayer(name, tileset, 0, 0, parsed.width, parsed.height, TILE, TILE);
      if (!layer) continue;
      for (let i = 0; i < data.length; i++) {
        if (data[i] >= 0) layer.putTileAt(data[i], i % parsed.width, Math.floor(i / parsed.width));
      }
      layer.setDepth(depth);
      this.layers.push(layer);
    }
    // 지붕처럼 캐릭터 머리를 덮어야 하는 타일만 캐릭터 위 레이어에 한 번 더 그린다
    const overhead = overheadTileIndices(ts);
    if (overhead.size) {
      const layer = map.createBlankLayer("overhead", tileset, 0, 0, parsed.width, parsed.height, TILE, TILE);
      if (layer) {
        for (const data of [parsed.ground, parsed.deco]) {
          for (let i = 0; i < data.length; i++) {
            if (overhead.has(data[i])) layer.putTileAt(data[i], i % parsed.width, Math.floor(i / parsed.width));
          }
        }
        layer.setDepth(OVERHEAD_DEPTH);
        this.layers.push(layer);
      }
    }

    for (const def of this.defs) {
      if (this.removed.has(def.id)) continue;
      this.index.add(def);
      this.createObjectSprite(def);
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, parsed.width * TILE, parsed.height * TILE);
    this.player.setVisible(true);
    this.nuri.setVisible(this.companionVisible);
    this.teleport(spawn.x, spawn.y, spawn.facing);
    cam.startFollow(this.player, true);

    const problems: string[] = [];
    this.fx.apply(resolveAmbience(region.ambience, problems), region.id);
    if (problems.length) console.warn(`[world] ${region.id} ambience: ${problems.join("; ")}`);
  }

  /**
   * manifest.tileAnimations(또는 options.tileAnimations)를 타일셋에 붙인다. Phaser TilemapLayer가 그릴 때
   * tileData[id].animation으로 프레임을 고르므로 맵 데이터는 그대로이고 매 프레임 할 일이 없다.
   */
  private setupTileAnimations(tileset: Phaser.Tilemaps.Tileset, tiles: string[]): void {
    const problems: string[] = [];
    const anims = resolveTileAnimations(this.options.tileAnimations ?? manifest.tileAnimations, tiles, problems).filter((a) => {
      // 타일셋 이미지에 프레임 타일이 아직 없으면(옛 PNG) 그 칸이 비어 보이므로 쓰지 않는다
      const ok = a.frames.every((f) => f < tileset.total);
      if (!ok) problems.push(`${a.name}: 타일셋 이미지(${tileset.total}칸)에 프레임 타일이 없음`);
      return ok;
    });
    if (problems.length) console.warn(`[world] tileAnimations: ${problems.join("; ")}`);
    this.tileAnims = anims;
    this.tileAnimData = phaserTileData(anims);
    if (!anims.length) return;
    const data = (tileset.tileData ?? {}) as Record<number, object>;
    for (const [id, d] of Object.entries(this.tileAnimData)) data[Number(id)] = { ...data[Number(id)], ...d };
    tileset.tileData = data;
  }

  private clearRegion(): void {
    this.stopMovement();
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    this.npcs.clear();
    this.turnedNpc = null;
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.tilemap?.destroy();
    this.tilemap = null;
    this.tileset = null;
    this.tileAnims = [];
    this.tileAnimData = {};
    this.region = null;
    this.parsed = null;
    // 연출 도중에 지역이 바뀌면 기다리던 쪽이 멈추지 않도록 바로 끝낸다
    for (const r of [...this.removing.values()]) r.cancel();
    this.removing.clear();
  }

  private spriteFor(def: MapObjectDef): string | null {
    let key: string | undefined;
    if (def.type === "trigger" || def.type === "spawn") return null;
    if (def.type === "monster") {
      const problem = this.region?.problems?.find((p) => p.id === def.props.problem);
      key = problem?.enemy?.sprite;
    }
    key ??= typeof def.props.sprite === "string" ? def.props.sprite : undefined;
    key ??= def.type === "monster" ? "monster_type_slime" : def.type === "npc" ? "npc_villager" : TYPE_SPRITE[def.type];
    if (!key) return null;
    if (!this.textures.exists(key)) this.ensureSprite(key);
    return key;
  }

  private createObjectSprite(def: MapObjectDef): void {
    const key = this.spriteFor(def);
    if (!key) return;
    const s = this.add.sprite(def.x * TILE + TILE / 2, (def.y + 1) * TILE, key, 0).setOrigin(0.5, 1);
    s.setDepth(DEPTH_BASE + def.y + 1);
    this.sprites.set(def.id, s);
    if (isCharacterSprite(key)) {
      // 맵 위 NPC: 서서 숨쉬고 가끔 깜빡인다(옛 시트는 서기 프레임 그대로). 말을 걸면 플레이어 쪽을 본다
      const prop = def.props.facing;
      const home = typeof prop === "string" && (VALID_FACINGS as readonly string[]).includes(prop) ? (prop as Facing) : "down";
      const anim = new CharacterAnimator(home, def.x * 7 + def.y * 13, 0);
      anim.stop(this.time.now - ((def.x * 389 + def.y * 211) % 1500), home, true);
      const view: NpcView = { sprite: s, anim, frame: -1, bob: 0, home };
      this.npcs.set(def.id, view);
      this.drawCharacter(view, anim.sample(this.time.now));
      return;
    }
    const idle = `${key}:idle`;
    if (this.anims.exists(idle)) {
      s.anims.play(idle);
      // 같은 종류가 한꺼번에 움직이지 않도록 시작 프레임을 엇갈리게
      const n = this.idleFrames(key);
      s.anims.setProgress(((def.x * 7 + def.y * 3) % n) / n);
    }
  }

  // ── 입력(DOM) ──────────────────────────────────────────────────────
  private attachDomInput(): void {
    const editableFocused = (e?: Event) =>
      isEditableElement(document.activeElement) || (e ? isEditableElement(e.target) : false);

    const onKeyDown = (e: KeyboardEvent) => {
      // UI가 이미 처리한 키(모달을 닫은 Esc 등)는 무시한다. 모달이 닫히면서 입력이 다시 켜진 뒤
      // 같은 keydown이 window까지 올라와 메뉴를 다시 여는 일이 있었다
      if (e.defaultPrevented) return;
      if (!this.inputEnabled || !this.region) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (editableFocused(e)) return;
      const action = keyAction(e.code, e.key);
      if (!action) return;
      if (action.kind === "interact" && isActivatableElement(document.activeElement)) return;
      e.preventDefault();
      if (action.kind === "move") {
        this.held = this.held.filter((d) => d !== action.dir);
        this.held.push(action.dir);
        if (!e.repeat) {
          this.pendingDir = action.dir;
          this.bumpLatch = null;
        }
        this.tryStep();
      } else if (e.repeat) {
        return;
      } else if (action.kind === "interact") {
        if (this.moving) this.pendingInteract = true;
        else this.interact();
      } else {
        this.safe(() => this.callbacks.onMenu());
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = keyAction(e.code, e.key);
      if (action?.kind === "move") this.held = this.held.filter((d) => d !== action.dir);
    };
    const clearKeys = () => {
      this.held = [];
      this.pendingDir = null;
      this.pendingInteract = false;
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isEditableElement(e.target)) return;
      clearKeys();
      this.setPhaserKeyboard(false);
    };
    const onFocusOut = () => {
      if (this.inputEnabled) this.setPhaserKeyboard(true);
    };
    // 캔버스를 눌러도 에디터 포커스가 저절로 빠지지 않는다(research.md §3.3.3)
    const onPointerDown = () => {
      const el = document.activeElement;
      if (this.inputEnabled && el instanceof HTMLElement && isEditableElement(el)) el.blur();
    };
    const canvas = this.game.canvas;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    canvas.addEventListener("pointerdown", onPointerDown);
    this.detachDom = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      canvas.removeEventListener("pointerdown", onPointerDown);
      this.detachDom = null;
    };
  }

  /** Phaser 자체 키보드(이 씬은 키를 등록하지 않지만 다른 코드가 쓸 수 있다)를 켜고 끈다 */
  private setPhaserKeyboard(on: boolean): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    if (on) {
      kb.enabled = true;
      kb.enableGlobalCapture();
    } else {
      kb.enabled = false;
      kb.disableGlobalCapture();
      kb.resetKeys();
    }
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.held = [];
    this.pendingDir = null;
    this.pendingInteract = false;
    // bumpLatch는 남겨 둔다: 전투에서 후퇴한 뒤 누르고 있던 방향키의 자동 반복으로 같은 몬스터에 다시 붙지 않게
    this.setPhaserKeyboard(enabled && !isEditableElement(document.activeElement));
    // 진행 중인 한 칸은 칸 정렬을 위해 끝까지 가고, 다음 칸은 시작하지 않는다
    if (!enabled && !this.moving) this.setIdleFrames();
    const deferred = this.deferredTrigger;
    if (enabled && deferred) {
      this.deferredTrigger = null;
      if (!this.moving && this.pos.x === deferred.x && this.pos.y === deferred.y) this.fireTriggers(deferred.x, deferred.y);
    }
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.error("[world] callback failed", err);
    }
  }

  // ── 이동 ───────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (!this.moving) {
      this.tryStep();
      // 막힌 칸을 향한 키를 떼면 제자리걸음을 멈춘다
      if (this.playerView.anim.state === "bump" && (!this.held.length || !this.inputEnabled)) {
        this.playerView.anim.stop(this.time.now);
      }
    }
    this.animate(delta);
  }

  /** 캐릭터 프레임·화면 연출을 시간에 맞춰 갱신한다 */
  private animate(delta: number): void {
    const now = this.time.now;
    this.drawCharacter(this.playerView, this.playerView.anim.sample(now));
    if (this.nuri.visible) this.drawCharacter(this.nuriView, this.nuriView.anim.sample(now));
    for (const npc of this.npcs.values()) this.drawCharacter(npc, npc.anim.sample(now));
    this.fx.update(now, delta);
  }

  private blocked(x: number, y: number): boolean {
    return !this.parsed || !inBounds(this.parsed, x, y) || this.grid[y * this.parsed.width + x] === 1;
  }

  private tryStep(): void {
    if (!this.region || this.moving || !this.inputEnabled) return;
    const fresh = this.pendingDir;
    const dir = fresh ?? this.held[this.held.length - 1];
    this.pendingDir = null;
    if (!dir) return;
    this.facing = dir;
    const [dx, dy] = DIRS[dir];
    const nx = this.pos.x + dx;
    const ny = this.pos.y + dy;
    const blocker = this.index.blockerAt(nx, ny);
    if (blocker) {
      // 몬스터는 접촉만으로 상호작용(심볼 인카운터, design.md §5.1)
      if (blocker.type === "monster" && this.bumpLatch !== blocker.id && !this.removing.has(blocker.id)) {
        this.setIdleFrames();
        this.bumpLatch = blocker.id;
        this.safe(() => this.callbacks.onInteract({ ...blocker, props: { ...blocker.props } }));
      } else {
        this.bumpInPlace();
      }
      return;
    }
    if (this.blocked(nx, ny)) {
      this.bumpInPlace();
      return;
    }
    this.bumpLatch = null;
    this.startMove(nx, ny);
  }

  /** 막힌 쪽으로 키를 누름: 그 방향으로 돌아서고, 누르고 있으면 제자리걸음(누리는 서 있음) */
  private bumpInPlace(): void {
    const now = this.time.now;
    this.playerView.anim.bump(this.facing, now);
    this.nuriView.anim.stop(now, this.nuriFacing);
  }

  private startMove(nx: number, ny: number): void {
    this.moving = true;
    const from = { ...this.pos };
    const dir = this.facing;
    const now = this.time.now;
    this.playerView.anim.beginStep(dir, now, STEP_MS);
    const pTween = this.tweens.add({
      targets: this.player,
      x: nx * TILE + TILE / 2,
      y: (ny + 1) * TILE,
      duration: STEP_MS,
      ease: "Linear",
      onUpdate: () => this.player.setDepth(DEPTH_BASE + this.player.y / TILE + 0.2),
      onComplete: () => this.finishMove(nx, ny),
    });
    this.moveTweens = [pTween];
    // 누리는 플레이어가 있던 칸으로 따라온다(뱀 따라가기)
    const nDir = facingFromDelta(from.x - this.nuriPos.x, from.y - this.nuriPos.y);
    if (nDir) {
      // 같은 걸음 번호 + 반 박자 위상차(nuriView의 phaseOffset)
      this.nuriView.anim.beginStep(nDir, now, STEP_MS, this.playerView.anim.stepIndex);
      this.nuriFacing = nDir;
      this.moveTweens.push(
        this.tweens.add({
          targets: this.nuri,
          x: from.x * TILE + TILE / 2,
          y: (from.y + 1) * TILE,
          duration: STEP_MS,
          ease: "Linear",
          onUpdate: () => this.nuri.setDepth(DEPTH_BASE + this.nuri.y / TILE + 0.1),
        }),
      );
    }
    this.nuriPos = from;
  }

  private nuriFacing: Facing = "down";
  private companionVisible = false;

  setCompanionVisible(visible: boolean): void {
    this.companionVisible = visible;
    this.nuri?.setVisible(visible);
  }

  /** 꾸미기 아이템 색(곱하기 틴트). null이면 원래 색 */
  setTint(target: "player" | "companion", color: number | null): void {
    const sprite = target === "player" ? this.player : this.nuri;
    if (!sprite) return;
    if (color === null) sprite.clearTint();
    else sprite.setTint(color);
  }

  private finishMove(x: number, y: number): void {
    this.moving = false;
    this.moveTweens = [];
    this.pos = { x, y };
    this.nuri.setPosition(this.nuriPos.x * TILE + TILE / 2, (this.nuriPos.y + 1) * TILE);
    this.nuri.setDepth(DEPTH_BASE + this.nuriPos.y + 1 + 0.1);
    const facing = this.facing;
    this.restoreTurnedNpc();
    this.safe(() => this.callbacks.onMoved({ x, y, facing }));
    // 이동 도중 메뉴 등으로 입력이 꺼졌으면 앱이 바빠서 트리거를 받지 못하므로, 입력이 다시 켜질 때 발동한다
    if (this.inputEnabled) this.fireTriggers(x, y);
    else this.deferredTrigger = { x, y };
    if (this.pendingInteract) {
      this.pendingInteract = false;
      if (this.inputEnabled) this.interact();
    }
    this.tryStep();
    if (!this.moving) this.setIdleFrames();
  }

  private fireTriggers(x: number, y: number): void {
    for (const t of this.index.triggersAt(x, y)) {
      // 콜백 안에서 teleport·loadRegion이 일어났으면 남은 트리거는 무시
      if (this.pos.x !== x || this.pos.y !== y || this.moving) break;
      this.safe(() => this.callbacks.onTrigger({ ...t, props: { ...t.props } }));
    }
  }

  /** (x, y)를 밟고 설 수 있는가(타일 + 오브젝트) */
  private standable(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && !this.blocked(x, y) && !this.index.blockerAt(x, y);
  }

  /**
   * 저장 위치가 맵 밖·벽·오브젝트 위(맵이 바뀐 옛 저장, 손으로 고친 저장 파일)이면 갇히지 않도록
   * 가장 가까운(맨해튼 거리) 설 수 있는 칸으로 옮긴다
   */
  private nearestStandable(x: number, y: number): Pos {
    if (this.standable(x, y) || !this.parsed) return { x, y };
    const { width, height } = this.parsed;
    const cx = Number.isFinite(x) ? Math.min(width - 1, Math.max(0, Math.round(x))) : 0;
    const cy = Number.isFinite(y) ? Math.min(height - 1, Math.max(0, Math.round(y))) : 0;
    for (let r = 0; r < width + height; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const dy = r - Math.abs(dx);
        for (const yy of dy === 0 ? [cy] : [cy - dy, cy + dy]) {
          if (this.standable(cx + dx, yy)) return { x: cx + dx, y: yy };
        }
      }
    }
    return { x: cx, y: cy };
  }

  /** 플레이어·누리를 서기(→ 잠시 뒤 숨쉬기·깜빡임)로 */
  private setIdleFrames(): void {
    if (!this.player) return;
    const now = this.time.now;
    this.playerView.anim.stop(now, this.facing);
    this.nuriView.anim.stop(now, this.nuriFacing);
    this.drawCharacter(this.playerView, this.playerView.anim.sample(now));
    this.drawCharacter(this.nuriView, this.nuriView.anim.sample(now));
  }

  /** 말을 건 NPC가 플레이어 쪽을 본다 */
  private turnNpcToPlayer(id: string): void {
    const npc = this.npcs.get(id);
    if (!npc) return;
    this.restoreTurnedNpc();
    npc.anim.stop(this.time.now, OPPOSITE[this.facing]);
    this.drawCharacter(npc, npc.anim.sample(this.time.now));
    this.turnedNpc = id;
  }

  /** 플레이어가 한 칸 움직이면 NPC는 원래 방향으로 돌아간다 */
  private restoreTurnedNpc(): void {
    const npc = this.turnedNpc ? this.npcs.get(this.turnedNpc) : undefined;
    this.turnedNpc = null;
    if (npc) npc.anim.stop(this.time.now, npc.home);
  }

  private stopMovement(): void {
    this.deferredTrigger = null;
    for (const t of this.moveTweens) t.stop();
    this.moveTweens = [];
    this.moving = false;
    this.pendingDir = null;
    this.pendingInteract = false;
    this.held = [];
  }

  private interact(): void {
    if (!this.region) return;
    const [dx, dy] = DIRS[this.facing];
    const target = this.index.blockerAt(this.pos.x + dx, this.pos.y + dy);
    if (target && !this.removing.has(target.id)) {
      if (target.type === "npc") this.turnNpcToPlayer(target.id);
      this.safe(() => this.callbacks.onInteract({ ...target, props: { ...target.props } }));
    }
  }

  teleport(tx: number, ty: number, facing: Facing): void {
    this.stopMovement();
    this.deferredTrigger = null;
    const { x, y } = this.nearestStandable(tx, ty);
    this.pos = { x, y };
    this.facing = facing;
    this.player.setPosition(x * TILE + TILE / 2, (y + 1) * TILE).setDepth(DEPTH_BASE + y + 1.2);
    // 누리는 플레이어 등 뒤 칸(막혀 있으면 다른 빈 이웃 칸, 없으면 같은 칸)
    const order: Facing[] = [OPPOSITE[facing], "down", "left", "right", "up"];
    let spot: Pos = { x, y };
    for (const d of order) {
      const [dx, dy] = DIRS[d];
      if (!this.blocked(x + dx, y + dy) && !this.index.blockerAt(x + dx, y + dy)) {
        spot = { x: x + dx, y: y + dy };
        break;
      }
    }
    this.nuriPos = spot;
    this.nuriFacing = facingFromDelta(x - spot.x, y - spot.y) ?? facing;
    this.nuri.setPosition(spot.x * TILE + TILE / 2, (spot.y + 1) * TILE).setDepth(DEPTH_BASE + spot.y + 1.1);
    this.setIdleFrames();
    this.cameras.main.centerOn(this.player.x, this.player.y - TILE / 2);
  }

  // ── 오브젝트 ───────────────────────────────────────────────────────
  removeObject(id: string, effect: "purify" | "open" | "none" = "purify"): Promise<void> {
    const pending = this.removing.get(id);
    if (pending) return pending.promise;
    if (this.removed.has(id) || !this.defs.some((d) => d.id === id)) {
      this.removed.add(id);
      return Promise.resolve();
    }
    // NPC라면 사라지는 동안 더 움직이지 않게
    this.npcs.delete(id);
    if (this.turnedNpc === id) this.turnedNpc = null;
    const finish = () => {
      this.removed.add(id);
      this.index.remove(id);
      this.sprites.get(id)?.destroy();
      this.sprites.delete(id);
      this.removing.delete(id);
    };
    const sprite = this.sprites.get(id);
    if (!sprite || effect === "none") {
      finish();
      return Promise.resolve();
    }
    let settle!: () => void;
    const promise = new Promise<void>((resolve) => {
      settle = resolve;
    });
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      finish();
      settle();
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      this.tweens.killTweensOf(sprite);
      settle();
    };
    this.removing.set(id, { promise, cancel });
    sprite.anims.stop();
    if (effect === "open") {
      if (this.frameCount(sprite.texture.key) > 1) sprite.setFrame(1);
      this.tweens.add({ targets: sprite, alpha: 0, delay: 260, duration: 240, onComplete: done });
    } else {
      this.sparkle(sprite.x, sprite.y - sprite.displayHeight / 2);
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 1.6,
        y: sprite.y - 6,
        duration: 420,
        ease: "Quad.easeIn",
        onComplete: done,
      });
    }
    return promise;
  }

  /** 정화 연출: 작은 빛 조각이 위로 흩어진다 */
  private sparkle(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dot = this.add.rectangle(x, y, 2, 2, i % 2 ? 0xfff2b3 : 0xb3ecff).setDepth(900);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * 12,
        y: y + Math.sin(a) * 8 - 10,
        alpha: 0,
        duration: 520,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }

  getPlayerPosition(): { x: number; y: number; facing: Facing } {
    return { x: this.pos.x, y: this.pos.y, facing: this.facing };
  }

  getObjects(): MapObjectDef[] {
    return this.defs.map((d) => ({ ...d, props: { ...d.props } }));
  }

  setAmbienceEnabled(on: boolean): void {
    this.fx.setEnabled(on);
  }

  inspect(): WorldInspect {
    const cam = this.cameras.main;
    const npcs: WorldInspect["npcs"] = {};
    for (const [id, v] of this.npcs) npcs[id] = this.characterInfo(v);
    const objects: WorldInspect["objects"] = {};
    for (const [id, s] of this.sprites) {
      if (this.npcs.has(id)) continue;
      objects[id] = { key: s.texture.key, frame: Number(s.frame.name), frames: this.frameCount(s.texture.key), depth: s.depth };
    }
    const elapsed = this.layers[0]?.timeElapsed ?? 0;
    const tileAnimations = this.tileAnims.map((a) => ({
      name: a.name,
      frames: [...a.frames],
      current: this.tileset?.getAnimatedTileId(a.frames[0], elapsed) ?? a.frames[0],
      cells: countAnimatedCells(this.parsed ? [this.parsed.ground, this.parsed.deco] : [], { [a.frames[0]]: this.tileAnimData[a.frames[0]] }),
    }));
    return {
      player: this.characterInfo(this.playerView),
      nuri: this.characterInfo(this.nuriView),
      npcs,
      objects,
      tileAnimations,
      ambience: this.fx.info(),
      fps: Math.round(this.game.loop.actualFps * 10) / 10,
      camera: { x: cam.worldView.x, y: cam.worldView.y, width: cam.width, height: cam.height },
    };
  }
}
