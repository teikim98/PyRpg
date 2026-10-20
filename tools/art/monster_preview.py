"""그래픽 개편·화풍 통일 미리보기: 지역 몬스터·보스 4프레임(검토용, 게임 에셋 아님).

    python tools/art/monster_preview.py          # 지역 1 → r1-monsters.png / r1-monsters.gif
    python tools/art/monster_preview.py r02      # 지역 2 → r02-monsters.png / r02-monsters.gif

- 몬스터마다 4프레임을 8배로(그 지역 바닥 위), 전투 화면 배율(몬스터 4배·보스 3배, 어두운 패널),
  맵 배율(1배·3배, 바닥·길 타일 위). 보스는 4프레임을 6배로
- GIF: 몬스터와 보스가 4프레임 제자리 루프를 도는 모습(4fps, 몬스터 4배·보스 3배 = 전투 화면 크기)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from boss import BOSSES  # noqa: E402
from build import text  # noqa: E402
from cave_boss import CAVE_BOSSES  # noqa: E402
from cave_monsters import CAVE_MONSTERS  # noqa: E402
from cozysamples import grass, path  # noqa: E402
from desert_boss import DESERT_BOSSES  # noqa: E402
from desert_monsters import DESERT_MONSTERS  # noqa: E402
from forest_boss import FOREST_BOSSES  # noqa: E402
from forest_monsters import FOREST_MONSTERS  # noqa: E402
from forest_tiles import FOREST_FLOOR, ROOT_FLOOR  # noqa: E402
from gif import write_gif  # noqa: E402
from gridlib import Canvas  # noqa: E402
from lake_boss import LAKE_BOSSES  # noqa: E402
from lake_monsters import LAKE_MONSTERS  # noqa: E402
from library_boss import LIBRARY_BOSSES  # noqa: E402
from library_monsters import LIBRARY_MONSTERS  # noqa: E402
from monsters import MONSTERS  # noqa: E402
from png import encode_png  # noqa: E402
from port_boss import PORT_BOSSES  # noqa: E402
from port_monsters import PORT_MONSTERS  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "docs", "art-overhaul")

BG = (0x2b, 0x24, 0x33, 255)
PANEL = (0x3a, 0x34, 0x46, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)
DIM = (0xa2, 0x94, 0xa0, 255)

REGIONS = {
    "r01": {
        "out": "r1-monsters", "title": "region 1 monsters", "monsters": MONSTERS, "bosses": BOSSES,
        "floor": grass, "path": path,
        "notes": {
            "monster_type_slime": "squash / stretch, base row fixed",
            "monster_remainder_bat": "fly 0 -1 -2 -1, wings fold on 1 3",
            "monster_iron_mole": "mound fixed, duck / pop up",
            "monster_echo_ghost": "fly, echo ring moves out",
            "monster_sep_sprite": "fly, wings fold on 1 3",
            "monster_clock_beetle": "minute hand ticks, legs alternate",
        },
        "boss": ("boss_stair_mimic", "glare / breathe / hand turns / threat"),
    },
    "r02": {
        "out": "r02-monsters", "title": "region 2 monsters", "monsters": FOREST_MONSTERS, "bosses": FOREST_BOSSES,
        "floor": lambda: FOREST_FLOOR, "path": lambda: ROOT_FLOOR,
        "notes": {
            "monster_fork_sprout": "squash / stretch, leaves droop / lift",
            "monster_leap_owl": "stand / crouch / leap 2px wings spread / land",
            "monster_loop_snake": "scale bands turn 1/4 step, blink on 3",
            "monster_count_shroom": "digit 3 2 1 0, squash / stretch",
            "monster_hail_wisp": "fly 0 -1 -2 -1, hail orbits",
            "monster_acorn_mite": "legs alternate, bob, blink on 3",
        },
        "boss": ("boss_crossroad_tree", "doze / breathe / hand turns / awake (roots glow)"),
    },
    # 지역 3~7: 화풍 통일 병렬 작업에서 그 지역 에이전트가 자기 칸의 floor·path·notes·boss만 채운다.
    # floor·path는 그 지역 타일 모듈을 함수 안에서 import한다(이 파일 머리의 import는 고치지 않음).
    # boss는 (이름, 메모) 하나 또는 보스가 둘인 지역은 그 목록
    "r03": {
        "out": "r03-monsters", "title": "region 3 monsters", "monsters": CAVE_MONSTERS, "bosses": CAVE_BOSSES,
        "floor": lambda: __import__("cave_tiles").CAVE_FLOOR,
        "path": lambda: __import__("cave_tiles").MINECART_RAIL,
        "notes": {
            "monster_index_goblin": "stand / crouch / stand / hop, tag 0 1 2 -1",
            "monster_slice_bat": "fly 0 -1 -2 -1, blade wings spread / up / down / up",
            "monster_stack_crab": "legs alternate, bob, top crate lags, claws up on 3",
            "monster_mirror_slime": "squash / stretch, mirror top reflects stalactites",
            "monster_grid_golem": "step bob, lit cell walks down the middle column, eyes glow on 3",
        },
        "boss": ("boss_goblin_chief", "glare / breathe / necklace hand turns / threat (roar, scepter up)"),
    },
    "r04": {
        "out": "r04-monsters", "title": "region 4 monsters", "monsters": LIBRARY_MONSTERS, "bosses": LIBRARY_BOSSES,
        "floor": lambda: __import__("library_tiles").LIB_FLOOR,
        "path": lambda: __import__("library_tiles").LIB_CARPET,
        "notes": {
            "monster_letter_moth": "fly 0 -1 -2 -1, wings fold up on 1 3",
            "monster_ink_slime": "squash / stretch, inkpot rides along, drip on 3",
            "monster_quill_sprite": "fly 0 -1 -2 -1, tip sways, ink drop forms / falls",
            "monster_scroll_snake": "wave flows 1/4 cycle, roll mark turns 1/4",
            "monster_cipher_owl": "wheel hands turn 1/4, letter A B C D, tassel sways",
        },
        "boss": ("boss_librarian_golem", "glare / breathe / dial hand turns / threat (eye wide, quill raised)"),
    },
    "r05": {
        "out": "r05-monsters", "title": "region 5 monsters", "monsters": PORT_MONSTERS, "bosses": PORT_BOSSES,
        "floor": lambda: __import__("port_tiles").PORT_COBBLE, "path": lambda: __import__("port_tiles").DOCK_PLANK,
        "notes": {
            "monster_twin_fish": "fly 0 -1 -2 -1, tail fin folds on 1 3, bubbles rise",
            "monster_ledger_gull": "stand / crouch / leap 2px wings spread / land",
            "monster_bubble_jelly": "fly 0 -1 -2 -1, bell squeezes on 1 3, tentacles sway",
            "monster_tally_parrot": "tally 2 3 4 5, stand / crouch / stand / beak open",
            "monster_queue_crab": "legs alternate, bob, tiny crabs hop front to back",
        },
        "boss": ("boss_smuggler_captain", "glare / breathe / dial turns / threat (ledger up, eye glows)"),
    },
    "r06": {
        "out": "r06-monsters", "title": "region 6 monsters", "monsters": LAKE_MONSTERS, "bosses": LAKE_BOSSES,
        "floor": None,
        "path": None,
        "notes": {},
        "boss": None,
    },
    "r07": {
        "out": "r07-monsters", "title": "region 7 monsters", "monsters": DESERT_MONSTERS, "bosses": DESERT_BOSSES,
        "floor": None,
        "path": None,
        "notes": {},
        "boss": None,
    },
}


def boss_list(cfg):
    """cfg["boss"]: (이름, 메모) 하나 또는 그 목록(중간 보스가 있는 지역)"""
    b = cfg["boss"]
    return b if isinstance(b, list) else [b]


def tiled(tile, w, h):
    cv = Canvas(w, h)
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            cv.draw(tile, x, y)
    return cv


def frame_cv(g):
    return Canvas(len(g[0]), len(g)).draw(g)


def sheet(cfg):
    S, BS = 8, 6
    order = list(cfg["notes"])
    cell = 16 * S + 8                 # 8배 프레임 칸
    battle_w = 4 * (64 + 6)           # 전투 배율 4프레임
    map_w = 4 * 18 + 8 + 4 * 52       # 1배 + 3배
    W = 16 + 4 * cell + 16 + battle_w + 16 + map_w + 16
    row_h = 16 * S + 30
    boss_h = 32 * BS + 30 + 96 + 16
    H = 16 + 20 + len(order) * row_h + 20 + len(boss_list(cfg)) * boss_h + 16
    cv = Canvas(W, H, BG)
    text(cv, f"{cfg['title']}  4 frames  (x8 / battle x4 / map x1 x3)", 16, 12, 2, HEAD)
    g_tile, p_tile = cfg["floor"](), cfg["path"]()
    y = 40
    for name in order:
        frames = cfg["monsters"][name]
        text(cv, f"{name.replace('monster_', '')}  -  {cfg['notes'][name]}", 16, y, 1, DIM)
        y0 = y + 10
        for i, g in enumerate(frames):
            bg = tiled(g_tile, 16, 16)
            bg.draw(g)
            cv.paste(bg, 16 + i * cell, y0, S)
            text(cv, str(i), 16 + i * cell + 2, y0 + 16 * S + 2, 1, DIM)
        bx = 16 + 4 * cell + 16
        cv.fill_rect(bx - 4, y0, battle_w + 4, 64 + 8, PANEL)
        for i, g in enumerate(frames):
            cv.paste(frame_cv(g), bx + i * 70, y0 + 4, 4)
        mx = bx + battle_w + 16
        strip = tiled(p_tile, 4 * 18, 16)
        for i, g in enumerate(frames):
            strip.draw(g, i * 18, 0)
        cv.paste(strip, mx, y0, 1)
        for i, g in enumerate(frames):
            bg = tiled(p_tile if i % 2 else g_tile, 16, 16)
            bg.draw(g)
            cv.paste(bg, mx + 4 * 18 + 8 + i * 52, y0, 3)
        y += row_h
    y += 20
    for boss, note in boss_list(cfg):
        text(cv, f"{boss}  -  {note} (x6, battle x3)", 16, y, 1, DIM)
        y0 = y + 10
        for i, g in enumerate(cfg["bosses"][boss]):
            bg = tiled(p_tile, 32, 32)
            bg.draw(g)
            cv.paste(bg, 16 + i * (32 * BS + 10), y0, BS)
        y1 = y0 + 32 * BS + 16
        cv.fill_rect(12, y1 - 4, 4 * 106 + 8, 96 + 8, PANEL)
        for i, g in enumerate(cfg["bosses"][boss]):
            cv.paste(frame_cv(g), 16 + i * 106, y1, 3)
        y += boss_h
    return cv


def gif_frames(cfg):
    order = list(cfg["notes"])
    bosses = [b for b, _ in boss_list(cfg)]
    W, H = len(order) * 72 + len(bosses) * 104 + 8 + 16, 112
    out = []
    for i in range(4):
        cv = Canvas(W, H, PANEL)
        for k, name in enumerate(order):
            cv.paste(frame_cv(cfg["monsters"][name][i]), 8 + k * 72, 24, 4)
        for k, boss in enumerate(bosses):
            cv.paste(frame_cv(cfg["bosses"][boss][i]), 8 + len(order) * 72 + 8 + k * 104, 8, 3)
        out.append(cv)
    return out


def main(region="r01"):
    cfg = REGIONS[region]
    os.makedirs(OUT, exist_ok=True)
    cv = sheet(cfg)
    png_path = os.path.join(OUT, f"{cfg['out']}.png")
    with open(png_path, "wb") as f:
        f.write(encode_png(cv.width, cv.height, cv.rows()))
    gif_path = os.path.join(OUT, f"{cfg['out']}.gif")
    write_gif(gif_path, gif_frames(cfg), delay_cs=25)
    for p in (png_path, gif_path):
        print(os.path.relpath(p, ROOT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "r01")
