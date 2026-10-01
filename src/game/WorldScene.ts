// 탐험 월드 씬: 타일맵 그리기, 그리드 이동, 충돌, 상호작용 감지(design.md §5.1, §9.7).
// 게임 규칙(전투 시작 여부, 문 열림 조건 등)은 판단하지 않고 콜백으로 알리기만 한다.
import * as Phaser from "phaser";
import { manifest } from "../contracts/assets";
import type { Region } from "../contracts/content";
import type { Facing } from "../contracts/state";
import type { MapObjectDef, WorldCallbacks } from "../contracts/world";
import {
  DIRS,
  FACING_ROW,
  OPPOSITE,
  ObjectIndex,
  buildCollisionGrid,
  facingFromDelta,
  inBounds,
  isActivatableElement,
  isEditableElement,
  keyAction,
} from "./grid";
import { makeSpriteCanvas, makeTilesetCanvas } from "./placeholders";
import { type ParsedMap, parseTiledMap } from "./tiled";

/** 한 칸 이동 시간(ms) */
export const STEP_MS = 135;
const TILE = manifest.tileSize;
const IDLE_FPS = 2;
const WALK_FPS = 8;
const DEPTH_BASE = 10;

const tilesetKey = (name: string) => `tileset:${name}`;

/** 오브젝트 종류별 기본 스프라이트(논리 이름) */
const TYPE_SPRITE: Partial<Record<MapObjectDef["type"], string>> = {
  sign: "obj_sign",
  chest: "obj_chest",
  door: "obj_door",
  campfire: "obj_campfire",
  rune: "obj_rune",
  warp: "obj_door",
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

  constructor(callbacks: WorldCallbacks, onReady: () => void, available: ReadonlySet<string> | null = null) {
    super({ key: "world" });
    this.callbacks = callbacks;
    this.onReady = onReady;
    this.available = available;
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

    this.player = this.add.sprite(0, 0, "player", 0).setOrigin(0.5, 1).setVisible(false);
    this.nuri = this.add.sprite(0, 0, "nuri", 0).setOrigin(0.5, 1).setVisible(false);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor("#1b1f2a");
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

  /** 스프라이트 텍스처가 없으면 자리 표시용으로 만들고, 애니메이션을 등록한다 */
  private ensureSprite(name: string): void {
    const def = manifest.sprites[name] ?? { frameWidth: name.startsWith("boss_") ? 32 : 16, frameHeight: name.startsWith("boss_") ? 32 : 16 };
    if (!this.textureOk(name, def.frameWidth, def.frameHeight) || this.textures.get(name).frameTotal <= 1) {
      this.replaceTexture(name);
      const { canvas, frames } = makeSpriteCanvas(name, def.frameWidth, def.frameHeight);
      const tex = this.textures.addCanvas(name, canvas)!;
      for (let i = 0; i < frames; i++) tex.add(i, 0, i * def.frameWidth, 0, def.frameWidth, def.frameHeight);
    }
    this.createAnims(name);
  }

  private frameCount(key: string): number {
    return Math.max(1, this.textures.get(key).frameTotal - 1);
  }

  private frame(key: string, i: number): number {
    return i % this.frameCount(key);
  }

  private createAnims(key: string): void {
    if (isCharacterSprite(key)) {
      for (const dir of Object.keys(FACING_ROW) as Facing[]) {
        const k = `${key}:walk:${dir}`;
        if (this.anims.exists(k)) continue;
        const row = FACING_ROW[dir] * 2;
        this.anims.create({
          key: k,
          frames: [{ key, frame: this.frame(key, row + 1) }, { key, frame: this.frame(key, row) }],
          frameRate: WALK_FPS,
          repeat: -1,
        });
      }
    } else if (!STATIC_SPRITES.has(key)) {
      const k = `${key}:idle`;
      if (!this.anims.exists(k)) {
        this.anims.create({
          key: k,
          frames: [{ key, frame: this.frame(key, 0) }, { key, frame: this.frame(key, 1) }],
          frameRate: IDLE_FPS,
          repeat: -1,
        });
      }
    }
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
    for (const [name, data, depth] of [["ground", parsed.ground, 0], ["deco", parsed.deco, 1]] as const) {
      const layer = map.createBlankLayer(name, tileset, 0, 0, parsed.width, parsed.height, TILE, TILE);
      if (!layer) continue;
      for (let i = 0; i < data.length; i++) {
        if (data[i] >= 0) layer.putTileAt(data[i], i % parsed.width, Math.floor(i / parsed.width));
      }
      layer.setDepth(depth);
      this.layers.push(layer);
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
  }

  private clearRegion(): void {
    this.stopMovement();
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.tilemap?.destroy();
    this.tilemap = null;
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
    const idle = `${key}:idle`;
    if (this.anims.exists(idle)) {
      s.anims.play(idle);
      // 같은 종류가 한꺼번에 깜빡이지 않도록 시작 프레임을 엇갈리게
      s.anims.setProgress((def.x * 7 + def.y * 3) % 2 ? 0.5 : 0);
    }
    this.sprites.set(def.id, s);
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
  update(): void {
    if (!this.moving) this.tryStep();
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
      this.setIdleFrames();
      // 몬스터는 접촉만으로 상호작용(심볼 인카운터, design.md §5.1)
      if (blocker.type === "monster" && this.bumpLatch !== blocker.id && !this.removing.has(blocker.id)) {
        this.bumpLatch = blocker.id;
        this.safe(() => this.callbacks.onInteract({ ...blocker, props: { ...blocker.props } }));
      }
      return;
    }
    if (this.blocked(nx, ny)) {
      this.setIdleFrames();
      return;
    }
    this.bumpLatch = null;
    this.startMove(nx, ny);
  }

  private startMove(nx: number, ny: number): void {
    this.moving = true;
    const from = { ...this.pos };
    const dir = this.facing;
    this.player.anims.play(`player:walk:${dir}`, true);
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
      this.nuri.anims.play(`nuri:walk:${nDir}`, true);
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

  private finishMove(x: number, y: number): void {
    this.moving = false;
    this.moveTweens = [];
    this.pos = { x, y };
    this.nuri.setPosition(this.nuriPos.x * TILE + TILE / 2, (this.nuriPos.y + 1) * TILE);
    this.nuri.setDepth(DEPTH_BASE + this.nuriPos.y + 1 + 0.1);
    const facing = this.facing;
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

  private setIdleFrames(): void {
    if (!this.player) return;
    this.player.anims.stop();
    this.player.setFrame(this.frame("player", FACING_ROW[this.facing] * 2));
    this.nuri.anims.stop();
    this.nuri.setFrame(this.frame("nuri", FACING_ROW[this.nuriFacing] * 2));
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
}
