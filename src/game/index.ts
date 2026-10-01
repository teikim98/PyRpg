// 월드 진입점: WorldFactory 구현(src/contracts/world.ts).
import * as Phaser from "phaser";
import type { WorldCallbacks, WorldController, WorldFactory } from "../contracts/world";
import { WorldScene } from "./WorldScene";
import { computeViewport, manifestImageFiles, probeImages } from "./viewport";

export { parseTiledMap } from "./tiled";
export type { ParsedMap } from "./tiled";
export { BASE_HEIGHT, BASE_WIDTH, computeViewport } from "./viewport";

export const createWorld: WorldFactory = {
  async create(parent: HTMLElement, callbacks: WorldCallbacks): Promise<WorldController> {
    const vp = computeViewport(parent.clientWidth, parent.clientHeight);
    const available = await probeImages(import.meta.env.BASE_URL ?? "/", manifestImageFiles());
    let scene!: WorldScene;
    const ready = new Promise<void>((resolve) => {
      scene = new WorldScene(callbacks, resolve, available);
    });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: vp.width,
      height: vp.height,
      zoom: vp.zoom,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: "#1b1f2a",
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: true, mouse: true, touch: true, gamepad: false },
      scale: { mode: Phaser.Scale.NONE },
      scene: [scene],
    });
    await ready;

    // 부모 크기가 바뀌면 배율과 시야를 다시 계산한다
    let current = vp;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const next = computeViewport(parent.clientWidth, parent.clientHeight);
            if (next.zoom === current.zoom && next.width === current.width && next.height === current.height) return;
            current = next;
            game.scale.setZoom(next.zoom);
            game.scale.resize(next.width, next.height);
          })
        : null;
    ro?.observe(parent);
    game.events.once(Phaser.Core.Events.DESTROY, () => ro?.disconnect());

    return {
      async loadRegion(region, spawn, removed) {
        scene.loadRegion(region, spawn, removed);
      },
      removeObject: (id, effect) => scene.removeObject(id, effect),
      setInputEnabled: (enabled) => scene.setInputEnabled(enabled),
      getPlayerPosition: () => scene.getPlayerPosition(),
      teleport: (x, y, facing) => scene.teleport(x, y, facing),
      setCompanionVisible: (visible) => scene.setCompanionVisible(visible),
      getObjects: () => scene.getObjects(),
      setTint: (target, color) => scene.setTint(target, color),
    };
  },
};
