// 도트 아트 PNG가 없거나 읽지 못했을 때 쓰는 자리 표시용 텍스처(design.md §9.8: 임시 에셋은 코드로 정의).
// 논리 이름만 보고 간단한 도형을 캔버스에 그린다. 실제 PNG가 생기면 자동으로 그쪽을 쓴다.

type Ctx = CanvasRenderingContext2D;

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function newCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

/** 이름에서 고른 안정적인 색(알 수 없는 이름용) */
function hashColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 55%)`;
}

const G = "#6aa84f";
const G2 = "#5b9443";

function grass(c: Ctx, ox: number, oy: number): void {
  rect(c, ox, oy, 16, 16, G);
  for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 10], [11, 12], [1, 14], [7, 6]]) rect(c, ox + x, oy + y, 1, 2, G2);
}

function bricks(c: Ctx, ox: number, oy: number, base: string, line: string, bw = 8, bh = 4): void {
  rect(c, ox, oy, 16, 16, base);
  for (let y = 0; y < 16; y += bh) {
    rect(c, ox, oy + y, 16, 1, line);
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = off; x < 16; x += bw) rect(c, ox + x, oy + y, 1, bh, line);
  }
}

/** 지형 타일 하나(16×16)를 (ox, oy)에 그린다 */
export function drawTile(c: Ctx, name: string, ox: number, oy: number): void {
  switch (name) {
    case "grass":
      return grass(c, ox, oy);
    case "grass_flower":
      grass(c, ox, oy);
      for (const [x, y, col] of [[3, 4, "#f6d55c"], [11, 3, "#ea9999"], [7, 11, "#ffffff"], [13, 12, "#f6d55c"]] as const) {
        rect(c, ox + x, oy + y, 2, 2, col);
      }
      return;
    case "path":
      rect(c, ox, oy, 16, 16, "#d2b48c");
      for (const [x, y] of [[3, 3], [10, 5], [6, 12], [13, 13], [1, 9]]) rect(c, ox + x, oy + y, 2, 1, "#b8956a");
      return;
    case "plaza_stone":
      return bricks(c, ox, oy, "#c4c0b8", "#a39e94", 8, 8);
    case "water":
      rect(c, ox, oy, 16, 16, "#6fa8dc");
      rect(c, ox + 2, oy + 4, 5, 1, "#cfe2f3");
      rect(c, ox + 9, oy + 10, 5, 1, "#cfe2f3");
      return;
    case "well":
      rect(c, ox + 2, oy + 5, 12, 10, "#8a8a8a");
      rect(c, ox + 4, oy + 7, 8, 6, "#2b2b3a");
      rect(c, ox + 3, oy + 1, 1, 6, "#6b4f2a");
      rect(c, ox + 12, oy + 1, 1, 6, "#6b4f2a");
      rect(c, ox + 3, oy + 1, 10, 1, "#6b4f2a");
      // 공중에 멈춘 물방울
      rect(c, ox + 7, oy + 3, 2, 2, "#9fc5f8");
      rect(c, ox + 5, oy + 0, 1, 1, "#9fc5f8");
      rect(c, ox + 10, oy + 4, 1, 1, "#9fc5f8");
      return;
    case "tree":
      rect(c, ox + 7, oy + 11, 2, 5, "#7f5539");
      rect(c, ox + 2, oy + 2, 12, 10, "#38761d");
      rect(c, ox + 4, oy + 0, 8, 2, "#38761d");
      rect(c, ox + 4, oy + 3, 3, 2, "#4f9a2f");
      rect(c, ox + 9, oy + 6, 2, 2, "#2d5e17");
      return;
    case "bush":
      rect(c, ox + 1, oy + 6, 14, 9, "#4e8f3a");
      rect(c, ox + 3, oy + 4, 10, 2, "#4e8f3a");
      rect(c, ox + 4, oy + 6, 3, 2, "#6fb352");
      rect(c, ox + 10, oy + 10, 2, 2, "#3b6e2c");
      return;
    case "house_wall":
      rect(c, ox, oy, 16, 16, "#e6d3b3");
      for (let y = 3; y < 16; y += 4) rect(c, ox, oy + y, 16, 1, "#c9b28f");
      return;
    case "house_roof":
      rect(c, ox, oy, 16, 16, "#a64d4d");
      for (let y = 0; y < 16; y += 4) {
        rect(c, ox, oy + y + 3, 16, 1, "#7f3434");
        rect(c, ox + ((y / 4) % 2 ? 4 : 0), oy + y, 1, 3, "#8a3c3c");
        rect(c, ox + ((y / 4) % 2 ? 12 : 8), oy + y, 1, 3, "#8a3c3c");
      }
      return;
    case "house_door":
      drawTile(c, "house_wall", ox, oy);
      rect(c, ox + 4, oy + 3, 8, 13, "#7f5539");
      rect(c, ox + 5, oy + 4, 6, 12, "#946846");
      rect(c, ox + 9, oy + 10, 1, 1, "#f1c232");
      return;
    case "house_window":
      drawTile(c, "house_wall", ox, oy);
      rect(c, ox + 3, oy + 3, 10, 9, "#7f5539");
      rect(c, ox + 4, oy + 4, 8, 7, "#9fc5f8");
      rect(c, ox + 7, oy + 4, 1, 7, "#7f5539");
      rect(c, ox + 4, oy + 7, 8, 1, "#7f5539");
      return;
    case "fence":
      rect(c, ox + 1, oy + 4, 2, 11, "#8b5a2b");
      rect(c, ox + 13, oy + 4, 2, 11, "#8b5a2b");
      rect(c, ox, oy + 6, 16, 2, "#a0703e");
      rect(c, ox, oy + 11, 16, 2, "#a0703e");
      return;
    case "wall_stone":
      bricks(c, ox, oy, "#5c5a66", "#403e48");
      rect(c, ox, oy, 16, 1, "#77748a");
      return;
    case "floor_wood":
      rect(c, ox, oy, 16, 16, "#a87b4f");
      for (let y = 0; y < 16; y += 4) rect(c, ox, oy + y, 16, 1, "#8c6239");
      return;
    case "floor_stone":
      rect(c, ox, oy, 16, 16, "#a9a6b4");
      rect(c, ox, oy, 16, 1, "#96939f");
      rect(c, ox, oy, 1, 16, "#96939f");
      rect(c, ox + 5, oy + 6, 2, 1, "#9b98a6");
      rect(c, ox + 11, oy + 11, 2, 1, "#9b98a6");
      return;
    case "stairs":
      rect(c, ox, oy, 16, 16, "#b0aab8");
      for (let x = 0; x < 16; x += 4) {
        rect(c, ox + x, oy, 1, 16, "#7a7484");
        rect(c, ox + x + 1, oy, 1, 16, "#cfc9d6");
      }
      return;
    case "clocktower_wall":
      return bricks(c, ox, oy, "#6d5f8a", "#54486e");
    case "clocktower_door":
      drawTile(c, "clocktower_wall", ox, oy);
      rect(c, ox + 4, oy + 4, 8, 12, "#3d2b1f");
      rect(c, ox + 5, oy + 3, 6, 1, "#3d2b1f");
      rect(c, ox + 10, oy + 10, 1, 1, "#f1c232");
      return;
    case "lamp_post":
      rect(c, ox + 7, oy + 5, 2, 10, "#333344");
      rect(c, ox + 5, oy + 14, 6, 2, "#333344");
      rect(c, ox + 5, oy + 1, 6, 5, "#333344");
      rect(c, ox + 6, oy + 2, 4, 3, "#ffe599");
      return;
    case "crate":
      rect(c, ox + 2, oy + 3, 12, 12, "#9c6b3c");
      rect(c, ox + 2, oy + 3, 12, 1, "#c08a52");
      for (let i = 0; i < 10; i++) {
        rect(c, ox + 3 + i, oy + 4 + i, 1, 1, "#6e4824");
        rect(c, ox + 12 - i, oy + 4 + i, 1, 1, "#6e4824");
      }
      return;
    case "market_stall":
      for (let x = 0; x < 16; x += 4) rect(c, ox + x, oy + 1, 4, 6, (x / 4) % 2 ? "#f4f4f4" : "#cc4125");
      rect(c, ox + 1, oy + 7, 1, 8, "#7f5539");
      rect(c, ox + 14, oy + 7, 1, 8, "#7f5539");
      rect(c, ox, oy + 10, 16, 5, "#a0703e");
      rect(c, ox + 3, oy + 8, 3, 2, "#f6b26b");
      rect(c, ox + 9, oy + 8, 3, 2, "#93c47d");
      return;
    case "flower_bed":
      rect(c, ox + 1, oy + 3, 14, 12, "#6b4f2a");
      rect(c, ox + 1, oy + 3, 14, 1, "#8a6a3a");
      for (const [x, y, col] of [[3, 5, "#e06666"], [8, 6, "#f6d55c"], [12, 5, "#c27ba0"], [5, 10, "#f6d55c"], [10, 11, "#e06666"]] as const) {
        rect(c, ox + x, oy + y, 2, 2, col);
        rect(c, ox + x, oy + y + 2, 1, 1, "#38761d");
      }
      return;
    case "dark_floor":
      rect(c, ox, oy, 16, 16, "#3b3546");
      for (const [x, y] of [[3, 2], [11, 6], [6, 13], [14, 11]]) rect(c, ox + x, oy + y, 1, 1, "#4e4760");
      return;
  }
  rect(c, ox, oy, 16, 16, hashColor(name));
  rect(c, ox, oy, 8, 8, "#000000");
  rect(c, ox + 8, oy + 8, 8, 8, "#000000");
}

/** 타일셋 전체 이미지(columns칸 × 필요한 줄) */
export function makeTilesetCanvas(tiles: string[], columns: number, size = 16): HTMLCanvasElement {
  const rows = Math.max(1, Math.ceil(tiles.length / columns));
  const [canvas, c] = newCanvas(columns * size, rows * size);
  tiles.forEach((name, i) => drawTile(c, name, (i % columns) * size, Math.floor(i / columns) * size));
  return canvas;
}

const CHARACTER_COLORS: Record<string, { body: string; hair: string }> = {
  player: { body: "#3d85c6", hair: "#4a3222" },
  nuri: { body: "#e69138", hair: "#7a2f1d" },
  npc_merchant: { body: "#6aa84f", hair: "#5b5b5b" },
  npc_villager: { body: "#8e7cc3", hair: "#3b2a1a" },
  npc_child: { body: "#f1c232", hair: "#6b3e1f" },
};

/** 걷는 캐릭터: 아래·왼쪽·오른쪽·위 × 2프레임 */
function drawCharacter(c: Ctx, name: string, frame: number, ox: number): void {
  const col = CHARACTER_COLORS[name] ?? { body: hashColor(name), hair: "#3b2a1a" };
  const dir = Math.floor(frame / 2);
  const step = frame % 2;
  const skin = "#f3d2b3";
  const small = name === "npc_child" ? 2 : 0;
  // 다리
  rect(c, ox + 5, 13, 2, 3 - step, "#3b3b4f");
  rect(c, ox + 9, 13, 2, 2 + step, "#3b3b4f");
  // 몸
  rect(c, ox + 4, 8 + small, 8, 6 - small, col.body);
  // 머리
  rect(c, ox + 4, 2 + small, 8, 7, skin);
  rect(c, ox + 4, 1 + small, 8, 3, col.hair);
  if (name === "nuri") {
    // 누리: 지도 제작자 모자 깃털 + 가방끈
    rect(c, ox + 11, 0 + small, 2, 2, "#f6d55c");
    rect(c, ox + 4, 9, 1, 4, "#7f5539");
  }
  if (dir === 0) {
    rect(c, ox + 5, 5 + small, 1, 2, "#222");
    rect(c, ox + 10, 5 + small, 1, 2, "#222");
  } else if (dir === 1) {
    rect(c, ox + 5, 5 + small, 1, 2, "#222");
    rect(c, ox + 9, 1 + small, 3, 6, col.hair);
  } else if (dir === 2) {
    rect(c, ox + 10, 5 + small, 1, 2, "#222");
    rect(c, ox + 4, 1 + small, 3, 6, col.hair);
  } else {
    rect(c, ox + 4, 1 + small, 8, 7, col.hair);
  }
}

const MONSTER_COLORS: Record<string, string> = {
  monster_type_slime: "#93c47d",
  monster_remainder_bat: "#8e7cc3",
  monster_iron_mole: "#a67c52",
  monster_echo_ghost: "#d9d2e9",
  monster_sep_sprite: "#76a5af",
  monster_clock_beetle: "#e69138",
};

function drawMonster(c: Ctx, name: string, frame: number, ox: number): void {
  const color = MONSTER_COLORS[name] ?? hashColor(name);
  const bob = frame % 2;
  if (name.includes("bat")) {
    rect(c, ox + 5, 5 + bob, 6, 6, color);
    rect(c, ox + (bob ? 1 : 0), 4 + bob * 3, 5, 3, color);
    rect(c, ox + (bob ? 10 : 11), 4 + bob * 3, 5, 3, color);
  } else if (name.includes("ghost")) {
    rect(c, ox + 3, 2 + bob, 10, 11, color);
    for (let x = 3; x < 13; x += 3) rect(c, ox + x, 13 + bob, 2, 2, color);
  } else if (name.includes("beetle")) {
    rect(c, ox + 3, 5 + bob, 10, 9, color);
    rect(c, ox + 7, 5 + bob, 1, 9, "#783f04");
    rect(c, ox + 6, 8 + bob, 4, 4, "#fff2cc");
    rect(c, ox + 7, 9 + bob, 1, 2, "#333");
  } else if (name.includes("mole")) {
    rect(c, ox + 3, 6, 10, 9, color);
    rect(c, ox + 6, 4 + bob, 4, 3, "#9e9e9e");
    rect(c, ox + 7, 11, 2, 1, "#ea9999");
  } else {
    rect(c, ox + 2, 7 + bob, 12, 8 - bob, color);
    rect(c, ox + 4, 5 + bob, 8, 2, color);
  }
  rect(c, ox + 5, 8 + bob, 2, 2, "#1b1b1b");
  rect(c, ox + 9, 8 + bob, 2, 2, "#1b1b1b");
  rect(c, ox + 5, 8 + bob, 1, 1, "#ffffff");
  rect(c, ox + 9, 8 + bob, 1, 1, "#ffffff");
}

function drawBoss(c: Ctx, frame: number, ox: number): void {
  // 계단 미믹: 계단 무늬 상자 몸통 + 이빨 달린 입
  const open = frame % 2;
  rect(c, ox + 2, 8, 28, 22, "#8c7b96");
  for (let y = 12; y < 30; y += 5) rect(c, ox + 2, y, 28, 1, "#6d5f78");
  rect(c, ox + 1, 4 - open * 2, 30, 6, "#a99bb3");
  rect(c, ox + 4, 12, 24, 5 + open * 3, "#2b1d2e");
  for (let x = 5; x < 27; x += 4) rect(c, ox + x, 12, 2, 2, "#ffffff");
  rect(c, ox + 9, 5 - open * 2, 4, 3, "#ff4d4d");
  rect(c, ox + 19, 5 - open * 2, 4, 3, "#ff4d4d");
}

function drawObject(c: Ctx, name: string, frame: number, ox: number): void {
  const f = frame % 2;
  switch (name) {
    case "obj_chest":
      rect(c, ox + 2, 6, 12, 9, "#9c6b3c");
      rect(c, ox + 2, 10, 12, 1, "#6e4824");
      if (f === 0) {
        rect(c, ox + 2, 4, 12, 4, "#b07a45");
        rect(c, ox + 7, 8, 2, 3, "#f1c232");
      } else {
        rect(c, ox + 2, 1, 12, 4, "#b07a45");
        rect(c, ox + 3, 6, 10, 3, "#2b1d14");
        rect(c, ox + 5, 6, 6, 2, "#f1c232");
      }
      return;
    case "obj_sign":
      rect(c, ox + 7, 9, 2, 7, "#7f5539");
      rect(c, ox + 2, 2, 12, 8, "#c08a52");
      rect(c, ox + 4, 4, 8, 1, "#6e4824");
      rect(c, ox + 4, 6, 6 + f, 1, "#6e4824");
      return;
    case "obj_campfire":
      rect(c, ox + 2, 13, 12, 2, "#6e4824");
      rect(c, ox + 4, 11, 8, 2, "#8b5a2b");
      rect(c, ox + 5, 5 + f, 6, 7 - f, "#e69138");
      rect(c, ox + 6, 3 + f * 2, 4, 5, "#f6b26b");
      rect(c, ox + 7, 6 + f, 2, 4, "#ffe599");
      return;
    case "obj_rune":
      rect(c, ox + 3, 3, 10, 12, "#8a8a99");
      rect(c, ox + 4, 2, 8, 1, "#8a8a99");
      rect(c, ox + 3, 14, 10, 2, "#6b6b78");
      rect(c, ox + 7, 5, 2, 7, f ? "#9fe8ff" : "#6fc7e8");
      rect(c, ox + 5, 7, 6, 2, f ? "#9fe8ff" : "#6fc7e8");
      return;
    case "obj_door":
      if (f === 0) {
        rect(c, ox, 0, 16, 16, "#7f5539");
        for (let x = 0; x < 16; x += 4) rect(c, ox + x, 0, 1, 16, "#5e3d26");
        rect(c, ox, 4, 16, 2, "#4a4a55");
        rect(c, ox, 11, 16, 2, "#4a4a55");
        rect(c, ox + 7, 7, 2, 3, "#f1c232");
      } else {
        rect(c, ox, 0, 3, 16, "#7f5539");
        rect(c, ox + 13, 0, 3, 16, "#7f5539");
      }
      return;
  }
  rect(c, ox + 2, 2, 12, 12, hashColor(name));
  rect(c, ox + 6, 6, 4, 4, f ? "#ffffff" : "#000000");
}

/** 스프라이트 시트 캔버스(가로로 프레임 나열)와 프레임 수 */
export function makeSpriteCanvas(name: string, frameWidth: number, frameHeight: number): { canvas: HTMLCanvasElement; frames: number } {
  const isCharacter = name === "player" || name === "nuri" || name.startsWith("npc_");
  const frames = isCharacter ? 8 : 2;
  const [canvas, c] = newCanvas(frameWidth * frames, frameHeight);
  for (let i = 0; i < frames; i++) {
    const ox = i * frameWidth;
    if (isCharacter) drawCharacter(c, name, i, ox);
    else if (name.startsWith("boss_")) drawBoss(c, i, ox);
    else if (name.startsWith("monster_")) drawMonster(c, name, i, ox);
    else drawObject(c, name, i, ox);
  }
  return { canvas, frames };
}
