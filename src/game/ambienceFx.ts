// 화면 연출(Phaser): 카메라 필터(색 보정 ColorMatrix + 비네트)와 떠다니는 입자.
// 값과 움직임 규칙은 ambience.ts(순수 코드)에 있다. 전투·대화창은 DOM이라 영향을 받지 않는다.
import * as Phaser from "phaser";
import {
  GRADE_PRESETS,
  PARTICLE_SPECS,
  type Particle,
  type ParticleShape,
  type ParticleSpec,
  type ResolvedAmbience,
  type View,
  gradeMatrix,
  hashString,
  particleDisplay,
  spawnParticles,
  stepParticle,
} from "./ambience";

/** 입자는 캐릭터·오브젝트(깊이 10+y)와 정화 연출(900)보다 위 */
const PARTICLE_DEPTH = 950;
const texKey = (shape: ParticleShape) => `ambience:${shape}`;

/** 입자 모양(흰색 + 투명도). 색은 틴트로 입힌다 */
const SHAPES: Record<ParticleShape, string[]> = {
  dot: ["#"],
  plus: [".#.", "###", ".#."],
  star: ["..+..", "..#..", "+###+", "..#..", "..+.."],
  leaf: ["##.", ".##"],
  blob: ["..:+++:..", ".:+###+:.", ":+#####+:", ".:+###+:.", "..:+++:.."],
};
const ALPHA: Record<string, number> = { "#": 1, "+": 0.55, ":": 0.25 };

function ensureTextures(scene: Phaser.Scene): void {
  for (const [shape, rows] of Object.entries(SHAPES) as [ParticleShape, string[]][]) {
    const key = texKey(shape);
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    const ctx = canvas.getContext("2d")!;
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const a = ALPHA[ch];
        if (!a) return;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    scene.textures.addCanvas(key, canvas);
  }
}

export interface AmbienceInfo {
  grade: string;
  particles: string;
  particleCount: number;
  filters: boolean;
  enabled: boolean;
}

export class AmbienceFx {
  private colorFilter: Phaser.Filters.ColorMatrix | null = null;
  private vignette: Phaser.Filters.Vignette | null = null;
  private particles: { p: Particle; img: Phaser.GameObjects.Image }[] = [];
  private spec: ParticleSpec | null = null;
  private current: ResolvedAmbience | null = null;
  private enabled = true;

  constructor(private scene: Phaser.Scene) {}

  /** 지역 분위기를 적용한다(지역을 불러올 때마다) */
  apply(ambience: ResolvedAmbience, seedKey: string): void {
    this.current = ambience;
    this.applyFilters(ambience);
    this.spawn(ambience, seedKey);
  }

  private applyFilters(ambience: ResolvedAmbience): void {
    const cam = this.scene.cameras.main;
    // Canvas 렌더러에는 필터가 없다
    const filters = (cam as { filters?: Phaser.Types.GameObjects.FiltersInternalExternal }).filters;
    if (!filters || this.scene.game.renderer.type !== Phaser.WEBGL) return;
    const preset = GRADE_PRESETS[ambience.grade];
    this.colorFilter ??= filters.external.addColorMatrix();
    this.colorFilter.colorMatrix.set(gradeMatrix(preset));
    const v = preset.vignette;
    if (!this.vignette) {
      this.vignette = filters.external.addVignette(0.5, 0.5, v.radius, v.strength, v.color, Phaser.BlendModes.MULTIPLY);
    } else {
      this.vignette.radius = v.radius;
      this.vignette.strength = v.strength;
      this.vignette.setColor(v.color);
    }
    this.colorFilter.setActive(this.enabled);
    this.vignette.setActive(this.enabled);
  }

  private clearParticles(): void {
    for (const { img } of this.particles) img.destroy();
    this.particles = [];
  }

  private view(): View {
    const v = this.scene.cameras.main.worldView;
    return { x: v.x, y: v.y, width: v.width || this.scene.scale.width, height: v.height || this.scene.scale.height };
  }

  private spawn(ambience: ResolvedAmbience, seedKey: string): void {
    this.clearParticles();
    this.spec = ambience.particles === "none" ? null : PARTICLE_SPECS[ambience.particles];
    if (!this.spec) return;
    ensureTextures(this.scene);
    const cam = this.scene.cameras.main;
    // 지역을 막 불러온 직후에는 worldView가 아직 갱신되지 않았을 수 있어 카메라 스크롤로 계산한다
    const view: View = { x: cam.scrollX, y: cam.scrollY, width: cam.width, height: cam.height };
    for (const p of spawnParticles(this.spec, view, hashString(seedKey))) {
      const img = this.scene.add
        .image(Math.round(p.x), Math.round(p.y), texKey(p.shape))
        .setOrigin(0, 0)
        .setTint(p.color)
        .setDepth(PARTICLE_DEPTH)
        .setAlpha(p.baseAlpha)
        .setVisible(this.enabled);
      this.particles.push({ p, img });
    }
  }

  update(now: number, deltaMs: number): void {
    if (!this.spec || !this.enabled || !this.particles.length) return;
    // 탭이 숨겨졌다 돌아오는 등 큰 간격은 잘라서 순간이동하지 않게
    const dt = Math.min(deltaMs, 100);
    const view = this.view();
    for (const { p, img } of this.particles) {
      stepParticle(p, dt, view);
      const d = particleDisplay(p, this.spec, now);
      if (!d.shape) {
        img.setVisible(false);
        continue;
      }
      img.setVisible(true);
      const key = texKey(d.shape);
      if (img.texture.key !== key) img.setTexture(key);
      // 왼쪽 위 기준으로 정수 좌표에 둬야 홀수 크기 모양이 반 픽셀에 걸리지 않는다
      img.setPosition(Math.round(d.x) - (img.width >> 1), Math.round(d.y) - (img.height >> 1));
      img.setAlpha(d.alpha);
    }
  }

  /** 연출 전체를 켜고 끈다(성능 측정·디버그용) */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.colorFilter?.setActive(on);
    this.vignette?.setActive(on);
    for (const { img } of this.particles) img.setVisible(on);
  }

  info(): AmbienceInfo {
    return {
      grade: this.current?.grade ?? "",
      particles: this.current?.particles ?? "",
      particleCount: this.particles.length,
      filters: !!this.colorFilter,
      enabled: this.enabled,
    };
  }

  destroy(): void {
    this.clearParticles();
  }
}
