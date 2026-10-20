"""그래픽 개편 미리보기: docs/art-overhaul/ 아래 PNG·GIF를 만든다(게임 에셋이 아니라 검토용).

    python tools/art/overhaul_preview.py

- palette.png       : 코지 팔레트 램프 스와치(이름·hex)와 낱색, 지역 강조색 칸
- materials.png     : 재질 샘플 타일(6배) + 3×3 이어 붙임(이음새 확인) + 샘플 타일 위에 캐릭터를 세운 작은 장면(3배)
- characters.png    : 새 캐릭터 시트 전체(6열 × 4행, 6배)
- walk.png          : 방향별 걷기 4프레임을 나란히(8배), 같은 프레임을 1배·3배로
- walk.gif          : 캐릭터 5명이 아래·오른쪽·위·왼쪽으로 걷고 멈춰 숨쉬고 깜빡이는 애니메이션(4배)

    python tools/art/overhaul_preview.py r02   # 화풍 통일: r02-characters.png(지역 NPC 시트 + 주인공·누리)만
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from build import text  # noqa: E402
from characters import RIGS  # noqa: E402
from charrig import COLS, DIRS  # noqa: E402
from cozypal import HEXES, RAMPS, REGION_ACCENTS, SINGLES, STEPS, c  # noqa: E402
from cozysamples import SAMPLES, bush_on_grass, flagstone, flower_patch, grass, grass_edge_over_path, path, planks, metal_panel, barn_board, water  # noqa: E402,E501
from gif import write_gif  # noqa: E402
from gridlib import PALETTE, Canvas  # noqa: E402
from png import encode_png  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "docs", "art-overhaul")

BG = (0x2b, 0x24, 0x33, 255)
PANEL = (0x3a, 0x34, 0x46, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)
TXT = (0xee, 0xea, 0xe4, 255)
DIM = (0xa2, 0x94, 0xa0, 255)


def rgba(name):
    return PALETTE[c(name)]


def frame_canvas(g):
    return Canvas(len(g[0]), len(g)).draw(g)


def save(cv: Canvas, name: str):
    os.makedirs(OUT, exist_ok=True)
    path_ = os.path.join(OUT, name)
    with open(path_, "wb") as f:
        f.write(encode_png(cv.width, cv.height, cv.rows()))
    return path_


# ── 팔레트 ───────────────────────────────────────────────────────────────────────
def palette_sheet():
    sw = 44
    names = list(RAMPS)
    W = 16 + 130 + 5 * (sw + 70) + 16
    rows_h = 30
    per = 4
    single_rows = -(-len(SINGLES) // per)
    H = 16 + 24 + len(names) * rows_h + 30 + single_rows * rows_h + 30 + len(REGION_ACCENTS) * rows_h + 16
    cv = Canvas(W, H, BG)
    text(cv, "cozy palette  ramps: ol / shade / base / hi / spec", 16, 16, 2, HEAD)
    y = 44
    for r in names:
        text(cv, r, 16, y + 8, 1, TXT)
        for k, s in enumerate(STEPS):
            x = 16 + 130 + k * (sw + 70)
            cv.fill_rect(x, y, sw, rows_h - 6, rgba(f"{r}.{s}"))
            text(cv, HEXES[f"{r}.{s}"], x + sw + 4, y + 8, 1, DIM)
        y += rows_h
    y += 10
    text(cv, "singles", 16, y, 2, HEAD)
    y += 20
    for k, n in enumerate(SINGLES):
        x = 16 + (k % per) * 180
        yy = y + (k // per) * rows_h
        cv.fill_rect(x, yy, sw, rows_h - 6, PANEL)
        cv.fill_rect(x, yy, sw, rows_h - 6, PALETTE[c(n)])
        v = HEXES[n]
        label = f"{v[0]} a{v[1]}" if isinstance(v, tuple) else v
        text(cv, f"{n} {label}", x + sw + 4, yy + 8, 1, DIM)
    y += single_rows * rows_h + 10
    text(cv, "region accents", 16, y, 2, HEAD)
    y += 20
    for reg, ramps in REGION_ACCENTS.items():
        text(cv, reg, 16, y + 8, 1, TXT)
        x = 16 + 60
        for rmp in ramps:
            for s in ("shade", "base", "hi"):
                cv.fill_rect(x, y, 24, rows_h - 6, rgba(f"{rmp}.{s}"))
                x += 24
            text(cv, rmp, x + 4, y + 8, 1, DIM)
            x += 110
        y += rows_h
    return cv


# ── 재질 샘플 ─────────────────────────────────────────────────────────────────────
def materials_sheet():
    S = 6
    cell = 16 * S + 14
    per = 6
    tiled = 16 * 3 * 2 + 14
    scene_w, scene_h = 14, 7
    W = 16 + per * cell + 16
    H = 16 + 22 + 2 * (cell + 12) + 22 + tiled + 22 + scene_h * 16 * 3 + 16
    cv = Canvas(W, H, BG)
    text(cv, "material samples  (16x16, 6x)", 16, 16, 2, HEAD)
    y = 40
    for i, (n, g) in enumerate(SAMPLES):
        x = 16 + (i % per) * cell
        yy = y + (i // per) * (cell + 12)
        cv.paste(frame_canvas(g), x, yy, S)
        text(cv, n, x, yy + 16 * S + 4, 1, TXT)
    y += 2 * (cell + 12)
    text(cv, "tiled 3x3 (2x): seams must not show", 16, y, 2, HEAD)
    y += 22
    x = 16
    for n in ("grass", "path", "flagstone", "planks", "metal", "water_0"):
        g = dict(SAMPLES)[n]
        t = frame_canvas(g)
        for j in range(3):
            for i in range(3):
                cv.paste(t, x + i * 32, y + j * 32, 2)
        x += 96 + 14
    y += tiled
    text(cv, "sample scene (3x): characters on sample tiles", 16, y, 2, HEAD)
    y += 22
    cv.paste(sample_scene(), 16, y, 3)
    return cv


SCENE = [
    "BBBBBMMMPPPPgg",
    "BBBBBMMMPPPPgf",
    "eeeeeeeeeeeeeg",
    "pppppppppppppg",
    "ggggggppgggbgg",
    "gfgbggppggggfg",
    "wwwwwwwwwwwwww",
]


def sample_scene(frame=0, actors_frame=None):
    key = {"g": grass(), "f": flower_patch(), "b": bush_on_grass(), "p": path(), "e": grass_edge_over_path(),
           "B": barn_board(), "M": metal_panel(), "P": planks(), "w": water(frame), "s": flagstone()}
    sc = Canvas(len(SCENE[0]) * 16, len(SCENE) * 16)
    for j, row in enumerate(SCENE):
        for i, ch in enumerate(row):
            sc.draw(key[ch], i * 16, j * 16)
    actors = [("player", 1, 3), ("nuri", 2, 3), ("npc_merchant", 6, 4), ("npc_villager", 9, 3), ("npc_child", 11, 5)]
    for k, (n, tx, ty) in enumerate(actors):
        fr = RIGS[n].frames()
        idx = 0 if actors_frame is None else actors_frame(k)
        # 발밑 그림자(반투명 타원 3줄)
        for dx in range(3, 13):
            sc.put(tx * 16 + dx, ty * 16 + 15, PALETTE[c("shadow")])
        sc.draw(fr[idx], tx * 16, ty * 16 - 8)
    # 떠다니는 반짝임 예시(노란 4방향 별 3×3)
    for sx, sy in ((40, 10), (150, 22), (196, 70), (90, 86)):
        sc.put(sx, sy, rgba("sparkle"))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sc.put(sx + dx, sy + dy, rgba("sparkle2"))
    return sc


# ── 캐릭터 ───────────────────────────────────────────────────────────────────────
def characters_sheet(rigs=RIGS):
    S = 6
    names = list(rigs)
    fw, fh = 16, 24
    cell_w, cell_h = fw * S + 6, fh * S + 6
    W = 16 + 70 + 6 * cell_w + 16
    H = 16 + len(names) * (4 * cell_h + 30) + 16
    cv = Canvas(W, H, BG)
    y = 16
    for n in names:
        frames = rigs[n].frames()
        text(cv, n, 16, y, 2, HEAD)
        for k in range(6):
            text(cv, COLS[k], 16 + 70 + k * cell_w, y + 6 + 10, 1, TXT)
        for d in range(4):
            text(cv, DIRS[d], 16, y + 26 + d * cell_h + 60, 1, TXT)
            for k in range(6):
                x = 16 + 70 + k * cell_w
                yy = y + 26 + d * cell_h
                cv.fill_rect(x, yy, fw * S, fh * S, PANEL)
                cv.paste(frame_canvas(frames[d * 6 + k]), x, yy, S)
        y += 4 * cell_h + 30
    return cv


WALK = (0, 1, 2, 3)


def walk_sheet():
    """방향별 걷기 4프레임(8배) — 다리 교차, 팔 흔들기, 몸 1px이 또렷이 읽히는지 보는 그림."""
    S = 8
    fw, fh = 16, 24
    names = list(RIGS)
    cell_w = fw * S + 6
    W = 16 + 4 * 4 * cell_w + 3 * 20 + 16
    H = 16 + 24 + len(names) * (fh * S + 30) + 16
    cv = Canvas(W, H, BG)
    text(cv, "walk cycle: stand / step A / stand / step B  (8x)   down | left | right | up", 16, 16, 2, HEAD)
    y = 44
    ground = rgba("grass.base")
    line = rgba("grass.shade")
    for n in names:
        frames = RIGS[n].frames()
        x = 16
        for d in range(4):
            for k in WALK:
                cv.fill_rect(x, y, fw * S, fh * S, ground)
                for yy in range(0, fh * S, S):  # 1px 오르내림을 재기 쉬운 가로 눈금
                    cv.fill_rect(x, y + yy, fw * S, 1, line)
                cv.paste(frame_canvas(frames[d * 6 + k]), x, y, S)
                x += cell_w
            x += 20
        text(cv, n, 16, y + fh * S + 6, 1, TXT)
        y += fh * S + 30
    return cv


def walk_gif_frames():
    """캐릭터 5명이 나란히 걷는 GIF(4배). 방향마다 4프레임 × 3주기 걷고, 멈춰 서기·숨쉬기·깜빡임을 보여 준다."""
    S = 4
    names = list(RIGS)
    fw, fh = 16, 24
    W = len(names) * (fw + 8) * S + 8 * S
    H = (fh + 8) * S
    out = []
    seq = []  # (방향, 열, 걷는 중인가)
    for d in (0, 2, 3, 1):
        seq += [(d, k, True) for k in (0, 1, 2, 3) * 3]
        seq += [(d, k, False) for k in (0, 0, 4, 4, 0, 5, 0)]
    rig_frames = {n: RIGS[n].frames() for n in names}
    for d, k, walking in seq:
        small = Canvas(W // S, H // S, rgba("grass.base"))
        g = grass()
        for gx in range(0, W // S, 16):
            for gy in range(0, H // S, 16):
                small.draw(g, gx, gy)
        for i, n in enumerate(names):
            # 누리는 걷는 동안 반 박자(1프레임) 어긋나게(plan.md §3)
            kk = (k + 1) % 4 if n == "nuri" and walking else k
            x = 4 + i * (fw + 8)
            for dx in range(3, 13):
                small.put(x + dx, 4 + fh - 1, PALETTE[c("shadow")])
            small.draw(rig_frames[n][d * 6 + kk], x, 4)
        big = Canvas(W, H)
        big.paste(small, 0, 0, S)
        out.append(big)
    return out


def region_characters(region):
    """화풍 통일: 그 지역 NPC 시트(6열 × 4행, 6배)를 주인공·누리와 나란히 → rNN-characters.png"""
    if region == "r02":
        from forest_npcs import RIGS as REGION_RIGS
    else:
        raise SystemExit(f"no NPC rigs for {region}")
    rigs = {"player": RIGS["player"], "nuri": RIGS["nuri"], **REGION_RIGS}
    print(os.path.relpath(save(characters_sheet(rigs), f"{region}-characters.png"), ROOT))


def main():
    if len(sys.argv) > 1:          # python tools/art/overhaul_preview.py r02 → 그 지역 캐릭터 시트만
        region_characters(sys.argv[1])
        return
    files = [
        save(palette_sheet(), "palette.png"),
        save(materials_sheet(), "materials.png"),
        save(characters_sheet(), "characters.png"),
        save(walk_sheet(), "walk.png"),
    ]
    gif_path = os.path.join(OUT, "walk.gif")
    write_gif(gif_path, walk_gif_frames(), delay_cs=14)
    files.append(gif_path)
    for f in files:
        print(os.path.relpath(f, ROOT))


if __name__ == "__main__":
    main()
