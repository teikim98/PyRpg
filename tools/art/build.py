"""도트 아트 빌드: assets/manifest.json에 적힌 PNG를 모두 만들고 미리보기 시트를 그린다.

    python3 tools/art/build.py            # assets/ 아래 PNG + 미리보기 생성
    python3 tools/art/check.py            # 크기·형식 검사 + 다시 빌드한 결과와 바이트 비교

그림은 tools/art/의 tiles.py · characters.py · monsters.py · boss.py · portraits.py(지역 1)와
forest_tiles.py · forest_npcs.py · forest_monsters.py · forest_boss.py(지역 2),
cave_tiles.py · cave_npcs.py · cave_monsters.py · cave_boss.py(지역 3, 팔레트 cavepal.py),
library_tiles.py · library_npcs.py · library_monsters.py · library_boss.py(지역 4, 팔레트 librarypal.py),
port_tiles.py · port_npcs.py · port_monsters.py · port_boss.py(지역 5, 팔레트 portpal.py),
lake_tiles.py · lake_npcs.py · lake_monsters.py · lake_boss.py(지역 6, 팔레트 lakepal.py),
desert_tiles.py(고장 난 다리 오브젝트 포함) · desert_npcs.py · desert_monsters.py · desert_boss.py(지역 7, 팔레트 desertpal.py)에
팔레트 문자 그리드(또는 도형으로 그리는 코드)로 정의되어 있다. 같은 코드면 언제나 같은 바이트가 나온다.
경계 장식 조각(manifest `edgeDecor`, 결정 20)은 edge_tiles.py가 그리고 assets/tiles/edges.png로 묶는다.

미리보기: docs/phase2/art-preview.png(지역 1 에셋), docs/phase3/art-preview-r02.png(지역 2 에셋 + 숲 장면),
docs/phase3/art-preview-r03.png(지역 3 에셋 + 동굴 장면), docs/phase3/art-preview-r04.png(지역 4 에셋 + 도서관 장면),
docs/phase3/art-preview-r05.png(지역 5 에셋 + 항구 장면), docs/phase3/art-preview-r06.png(지역 6 에셋 + 호수 장면),
docs/phase3/art-preview-r07.png(지역 7 에셋 + 사막 장면)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from boss import BOSSES  # noqa: E402
from cave_boss import CAVE_BOSSES  # noqa: E402
from cave_monsters import CAVE_MONSTERS  # noqa: E402
from cave_npcs import CAVE_CHARACTERS  # noqa: E402
from cave_tiles import CAVE_TILES  # noqa: E402
from desert_boss import DESERT_BOSSES  # noqa: E402
from desert_monsters import DESERT_MONSTERS  # noqa: E402
from desert_npcs import DESERT_CHARACTERS  # noqa: E402
from desert_tiles import DESERT_OBJECTS, DESERT_TILES  # noqa: E402
from edge_tiles import EDGE_PIECES  # noqa: E402
from characters import CHARACTERS  # noqa: E402
from forest_boss import FOREST_BOSSES  # noqa: E402
from forest_monsters import FOREST_MONSTERS  # noqa: E402
from forest_npcs import FOREST_CHARACTERS  # noqa: E402
from forest_tiles import FOREST_TILES  # noqa: E402
from gridlib import Canvas, sheet  # noqa: E402
from lake_boss import LAKE_BOSSES  # noqa: E402
from lake_monsters import LAKE_MONSTERS  # noqa: E402
from lake_npcs import LAKE_CHARACTERS  # noqa: E402
from lake_tiles import LAKE_TILES  # noqa: E402
from library_boss import LIBRARY_BOSSES  # noqa: E402
from library_monsters import LIBRARY_MONSTERS  # noqa: E402
from library_npcs import LIBRARY_CHARACTERS  # noqa: E402
from library_tiles import LIBRARY_TILES  # noqa: E402
from monsters import MONSTERS, OBJECTS  # noqa: E402
from png import encode_png  # noqa: E402
from port_boss import PORT_BOSSES  # noqa: E402
from port_monsters import PORT_MONSTERS  # noqa: E402
from port_npcs import PORT_CHARACTERS  # noqa: E402
from port_tiles import PORT_TILES  # noqa: E402
from portraits import PORTRAITS  # noqa: E402
from tiles import DECO_UNDER, TILE_ANIMATIONS, TILES as R01_TILES  # noqa: E402
from town_objects import TOWN_OBJECTS  # noqa: E402

TILES = {**R01_TILES, **FOREST_TILES, **CAVE_TILES, **LIBRARY_TILES, **PORT_TILES, **LAKE_TILES, **DESERT_TILES}
# 지역 2·3·4·5·6·7에서 새로 생긴 에셋(미리보기를 지역별로 나눌 때 쓴다)
R02_NAMES = set(FOREST_TILES) | set(FOREST_CHARACTERS) | set(FOREST_MONSTERS) | set(FOREST_BOSSES)
R03_NAMES = set(CAVE_TILES) | set(CAVE_CHARACTERS) | set(CAVE_MONSTERS) | set(CAVE_BOSSES)
R04_NAMES = set(LIBRARY_TILES) | set(LIBRARY_CHARACTERS) | set(LIBRARY_MONSTERS) | set(LIBRARY_BOSSES)
R05_NAMES = set(PORT_TILES) | set(PORT_CHARACTERS) | set(PORT_MONSTERS) | set(PORT_BOSSES)
R06_NAMES = set(LAKE_TILES) | set(LAKE_CHARACTERS) | set(LAKE_MONSTERS) | set(LAKE_BOSSES)
R07_NAMES = (set(DESERT_TILES) | set(DESERT_CHARACTERS) | set(DESERT_MONSTERS) | set(DESERT_BOSSES)
             | set(DESERT_OBJECTS))
# 단위 3-1 마을 시설(그림자 게시판·상점). 지역별 미리보기에는 넣지 않는다
TOWN_NAMES = {"obj_board", "obj_shop"}

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
PREVIEW = os.path.join(ROOT, "docs", "phase2", "art-preview.png")
PREVIEW_R02 = os.path.join(ROOT, "docs", "phase3", "art-preview-r02.png")
PREVIEW_R03 = os.path.join(ROOT, "docs", "phase3", "art-preview-r03.png")
PREVIEW_R04 = os.path.join(ROOT, "docs", "phase3", "art-preview-r04.png")
PREVIEW_R05 = os.path.join(ROOT, "docs", "phase3", "art-preview-r05.png")
PREVIEW_R06 = os.path.join(ROOT, "docs", "phase3", "art-preview-r06.png")
PREVIEW_R07 = os.path.join(ROOT, "docs", "phase3", "art-preview-r07.png")


def load_manifest():
    with open(os.path.join(ASSETS, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def sprite_frames(name: str):
    """논리 이름 → 프레임 그리드 리스트."""
    # TOWN_OBJECTS(코지 화풍으로 다시 그린 마을 오브젝트)가 monsters.OBJECTS의 옛 그림보다 먼저다
    for table in (TOWN_OBJECTS, CHARACTERS, MONSTERS, OBJECTS, BOSSES, FOREST_CHARACTERS, FOREST_MONSTERS, FOREST_BOSSES,
                  CAVE_CHARACTERS, CAVE_MONSTERS, CAVE_BOSSES, LIBRARY_CHARACTERS, LIBRARY_MONSTERS, LIBRARY_BOSSES,
                  PORT_CHARACTERS, PORT_MONSTERS, PORT_BOSSES, LAKE_CHARACTERS, LAKE_MONSTERS, LAKE_BOSSES,
                  DESERT_CHARACTERS, DESERT_MONSTERS, DESERT_BOSSES, DESERT_OBJECTS):
        if name in table:
            return table[name]
    raise KeyError(f"no art defined for sprite {name!r}")


def is_character(name: str) -> bool:
    return name in ("player", "nuri") or name.startswith("npc_")


def sheet_columns(name: str, spr, count: int) -> int:
    """시트 가로 칸 수. 새 형식 캐릭터(16×24)는 6열 × 4행, 나머지는 프레임을 가로 한 줄로 잇는다."""
    if is_character(name) and spr["frameHeight"] == 24:
        return 6
    return count


def sprite_sheet(name: str, spr) -> Canvas:
    frames = sprite_frames(name)
    fw, fh = spr["frameWidth"], spr["frameHeight"]
    cols = sheet_columns(name, spr, len(frames))
    if cols == len(frames):
        return sheet(frames, fw, fh)
    rows_n = -(-len(frames) // cols)
    c = Canvas(cols * fw, rows_n * fh)
    for i, f in enumerate(frames):
        if len(f) != fh or len(f[0]) != fw:
            raise ValueError(f"{name}: frame {i} is {len(f[0])}x{len(f)}, expected {fw}x{fh}")
        c.draw(f, (i % cols) * fw, (i // cols) * fh)
    return c


def scene_frame(name: str, old_index: int):
    """장면 미리보기용: 옛 8프레임 번호(방향×2 + 걸음)를 그 캐릭터 시트의 프레임으로 바꾼다.
    새 형식(24프레임)은 방향×6 + (0 서기 | 1 왼발)."""
    frames = sprite_frames(name)
    if is_character(name) and len(frames) == 24:
        return frames[(old_index // 2) * 6 + (old_index % 2)]
    return frames[old_index]


def portrait_grid(name: str):
    key = name.removeprefix("portrait_")
    if key not in PORTRAITS:
        raise KeyError(f"no art defined for portrait {name!r}")
    return PORTRAITS[key][0]


def check_tile_animations(manifest):
    """지역 1 타일 애니메이션(tiles.TILE_ANIMATIONS)이 manifest `tileAnimations`와 같은지."""
    anims = manifest.get("tileAnimations", {})
    for key, anim in TILE_ANIMATIONS.items():
        if anims.get(key) != anim:
            raise ValueError(f"manifest tileAnimations.{key} must be {anim!r} (tools/art/tiles.py), got {anims.get(key)!r}")


def render_assets(manifest):
    """{assets 기준 상대 경로: Canvas}"""
    check_tile_animations(manifest)
    out = {}
    ts = manifest["tileSize"]
    for tname, tset in manifest["tilesets"].items():
        cols = tset["columns"]
        names = tset["tiles"]
        rows = -(-len(names) // cols)
        c = Canvas(cols * ts, rows * ts)
        for i, n in enumerate(names):
            if n not in TILES:
                raise KeyError(f"no art defined for tile {n!r}")
            c.draw(TILES[n], (i % cols) * ts, (i // cols) * ts)
        out[tset["file"]] = c
    for name, spr in manifest["sprites"].items():
        out[spr["file"]] = sprite_sheet(name, spr)
    decor = manifest.get("edgeDecor")
    if decor:  # 경계 장식 조각 시트(edge_tiles.py, 결정 20)
        cols = decor["columns"]
        names = decor["pieces"]
        c = Canvas(cols * ts, -(-len(names) // cols) * ts)
        for i, n in enumerate(names):
            if n not in EDGE_PIECES:
                raise KeyError(f"no art defined for edge piece {n!r}")
            c.draw(EDGE_PIECES[n], (i % cols) * ts, (i // cols) * ts)
        out[decor["file"]] = c
    for name, por in manifest["portraits"].items():
        g = portrait_grid(name)
        size = por["size"]
        out[por["file"]] = sheet([g], size, size)
    return out


# ── 미리보기용 3×5 픽셀 글꼴 ──────────────────────────────────────────────────────
FONT = {
    "a": "010101111101101", "b": "110101110101110", "c": "011100100100011", "d": "110101101101110",
    "e": "111100110100111", "f": "111100110100100", "g": "011100101101011", "h": "101101111101101",
    "i": "111010010010111", "j": "001001001101010", "k": "101101110101101", "l": "100100100100111",
    "m": "101111111101101", "n": "000110101101101", "o": "010101101101010", "p": "110101110100100",
    "q": "010101101110011", "r": "110101110101101", "s": "011100010001110", "t": "111010010010010",
    "u": "101101101101111", "v": "101101101101010", "w": "101101111111101", "x": "101101010101101",
    "y": "101101010010010", "z": "111001010100111", "0": "111101101101111", "1": "010110010010111",
    "2": "110001010100111", "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
    "6": "011100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001110",
    "_": "000000000000111", "-": "000000111000000", "/": "001001010100100", ".": "000000000000010",
    ":": "000010000010000", "(": "010100100100010", ")": "010001001001010", " ": "000000000000000",
    "x2": "000101010101000",
}


def text(c: Canvas, s: str, x: int, y: int, scale: int = 1, color=(236, 236, 240, 255)):
    for ch in s.lower():
        glyph = FONT.get(ch, FONT[" "])
        for j in range(5):
            for i in range(3):
                if glyph[j * 3 + i] == "1":
                    c.fill_rect(x + i * scale, y + j * scale, scale, scale, color)
        x += 4 * scale
    return x


BG = (88, 92, 104, 255)
PANEL = (72, 75, 86, 255)
HEAD = (246, 220, 124, 255)


SCENE_R01_ROWS = [
    "TTggDWWWRRRRgg",
    "TgggDWHHRORRgf",
    "ggggDppppppppg",
    "gwgggpPPPPPpgg",
    "ggfggpPlPPcPpg",
    "BBgggpPPPmPPpF",
    "ggggggpppppppg",
    "fffgggggkkkkkk",
]
SCENE_R01_KEY = {"g": "grass", "f": "grass_flower", "p": "path", "P": "plaza_stone", "w": "well", "T": "tree",
                 "B": "bush", "W": "house_wall", "H": "house_window", "R": "house_roof", "O": "house_door",
                 "D": "fence", "l": "lamp_post", "c": "crate", "m": "market_stall", "F": "flower_bed", "k": "water"}
SCENE_R01_ACTORS = [("player", 2, 5, 3), ("nuri", 0, 6, 3), ("npc_merchant", 0, 10, 3), ("monster_type_slime", 0, 7, 4),
                    ("obj_sign", 0, 3, 2), ("obj_rune", 1, 1, 4), ("obj_campfire", 0, 11, 6), ("obj_chest", 0, 12, 4),
                    ("npc_child", 6, 9, 6), ("monster_remainder_bat", 0, 12, 1)]

SCENE_R01 = (SCENE_R01_ROWS, SCENE_R01_KEY, SCENE_R01_ACTORS)

# 갈림길 숲: 갈라지는 뿌리 길, 디딤돌로 건너는 멈춘 개울, 전나무 숲 벽
SCENE_R02_ROWS = [
    "PPPPPPTPPPP~~PPPTPPP",
    "P,.gg..mPP.~~.,..BPP",
    "P.rrrrrrrrroorrrrr.P",
    "P.r..S...r.~~..gr.PP",
    "P.r.L....r.~~.m.r..P",
    "P,rrrrYrrr.~~..,r.BP",
    "P..g.r...,.~~.rrr..P",
    "PB.,.r..m..~~.r..S.P",
    "PPPPPrPPPPP~~PPrPPPP",
]
SCENE_R02_KEY = {".": "forest_floor", ",": "fallen_leaves", "g": "tall_grass", "S": "stump", "L": "log",
                 "m": "mushroom_patch", "~": "stream", "o": "stepping_stone", "Y": "signpost_fork", "P": "pine_tree",
                 "B": "moss_stone", "r": "root_floor", "T": "tree"}
SCENE_R02_ACTORS = [("player", 4, 4, 2), ("nuri", 4, 3, 2), ("monster_fork_sprout", 0, 9, 2),
                    ("monster_leap_owl", 0, 16, 3), ("monster_loop_snake", 0, 5, 6), ("monster_count_shroom", 0, 7, 4),
                    ("monster_hail_wisp", 0, 13, 6), ("monster_acorn_mite", 0, 16, 7), ("npc_traveler", 0, 2, 4),
                    ("npc_woodcutter", 2, 15, 1), ("obj_rune", 1, 14, 2), ("obj_campfire", 0, 18, 6),
                    ("obj_chest", 0, 1, 1), ("obj_sign", 0, 3, 3)]
SCENE_R02 = (SCENE_R02_ROWS, SCENE_R02_KEY, SCENE_R02_ACTORS)

# 고블린 동굴: 얼어붙은 횃불이 걸린 벽, 바랜 벽화, 거울 웅덩이, 광차 레일, 줄지어 굳은 보물 더미, 바위 틈(숨은 길)
SCENE_R03_ROWS = [
    "TTTTTTTTTTTTTTTTTTTT",
    "TTWWfWWWTTTTWWMMWWTT",
    "TT........TT......WT",
    "Tf...$$$..Wf..*...cT",
    "T..b..........~~~...",
    "T...........*.~~~..T",
    "=====....r....~~~..T",
    "T.......====.......T",
    "TTTTTTTTTTTTTTTTTTTT",
]
SCENE_R03_KEY = {".": "cave_floor", "T": "cave_wall_top", "W": "cave_wall", "f": "torch_frozen", "M": "mural_wall",
                 "c": "cave_crack", "*": "crystal", "r": "rubble", "$": "treasure_pile", "~": "cave_pool",
                 "=": "minecart_rail", "b": "bone_pile"}
SCENE_R03_ACTORS = [("player", 4, 6, 4), ("nuri", 4, 5, 4), ("npc_goblin", 0, 8, 4),
                    ("monster_index_goblin", 0, 2, 5), ("monster_slice_bat", 0, 12, 2),
                    ("monster_stack_crab", 0, 10, 5), ("monster_mirror_slime", 0, 17, 5),
                    ("monster_grid_golem", 0, 16, 2), ("obj_rune", 1, 3, 2), ("obj_campfire", 0, 6, 6),
                    ("obj_chest", 0, 9, 2), ("obj_sign", 0, 13, 3), ("obj_board", 0, 2, 2)]
SCENE_R03 = (SCENE_R03_ROWS, SCENE_R03_KEY, SCENE_R03_ACTORS)

# 무너진 대도서관: 책장 벽(빈 책장 칸 하나가 숨은 길), 카펫 통로, 열람 책상, 얼어붙은 촛대, 떠 있는 페이지
SCENE_R04_ROWS = [
    "TTTTTTTTTTTTTTTTTTTT",
    "TWBBWBBBWBBgBBWBBWWT",
    "T.c.......~~.....c.T",
    "T...P..........d...T",
    "T==================T",
    "T....d......BBBB...T",
    "T.F.........BBBB.b.T",
    "T..b..~....P.....c.T",
    "TTTTTTTTTTTTTTTTTTTT",
]
SCENE_R04_KEY = {".": "lib_floor", "=": "lib_carpet", "T": "lib_wall_top", "W": "lib_wall", "B": "bookshelf",
                 "g": "shelf_gap", "F": "bookshelf_fallen", "b": "book_pile", "d": "reading_desk",
                 "c": "candle_frozen", "P": "broken_pillar", "~": "floating_pages"}
SCENE_R04_ACTORS = [("player", 4, 7, 4), ("nuri", 4, 6, 4), ("npc_ghost_librarian", 0, 9, 3),
                    ("monster_letter_moth", 0, 3, 2), ("monster_ink_slime", 0, 14, 3),
                    ("monster_quill_sprite", 0, 16, 6), ("monster_scroll_snake", 0, 9, 6),
                    ("monster_cipher_owl", 0, 13, 2), ("obj_rune", 1, 6, 2), ("obj_campfire", 0, 4, 6),
                    ("obj_chest", 0, 11, 2), ("obj_sign", 0, 1, 3), ("obj_board", 0, 18, 5)]
SCENE_R04 = (SCENE_R04_ROWS, SCENE_R04_KEY, SCENE_R04_ACTORS)

# 교역항: 자갈길 시장(생선 좌판), 화물 상자 더미(밧줄 더미 바로 북쪽의 빈 상자가 숨은 길), 세로 널 부두와
# 계선주·통·그물, 유리처럼 굳은 파도가 선 바다, 가로 널 갑판과 난간, 줄무늬 등대 벽
SCENE_R05_ROWS = [
    "SScSScCCCCgCCCCc~~LL",
    "c.........r....c~wLL",
    "c..............c~~LL",
    "c..............|==|~",
    "c...b===n===b==|==|~",
    "~~~~|=========|===|~",
    "~w~~|===b=====|$$$$$",
    "~~~~|==========$$$$$",
    "~~w~~~~~~~~~~~~RRRRR",
]
SCENE_R05_KEY = {".": "port_cobble", "c": "port_cobble", "=": "dock_plank", "~": "harbor_water", "w": "frozen_wave",
                 "|": "pier_post", "C": "port_crate", "g": "crate_gap", "b": "barrel", "r": "rope_coil",
                 "n": "fishing_net", "S": "port_stall", "$": "ship_deck", "R": "ship_rail", "L": "lighthouse_wall"}
SCENE_R05_ACTORS = [("player", 4, 6, 2), ("nuri", 4, 5, 2), ("npc_guild_master", 0, 3, 2),
                    ("npc_merchant", 0, 1, 1), ("monster_twin_fish", 0, 13, 2), ("monster_ledger_gull", 0, 7, 1),
                    ("monster_bubble_jelly", 0, 10, 5), ("monster_tally_parrot", 0, 12, 3),
                    ("monster_queue_crab", 0, 6, 7), ("obj_rune", 1, 9, 2), ("obj_campfire", 0, 2, 3),
                    ("obj_chest", 0, 14, 1), ("obj_sign", 0, 4, 1), ("obj_board", 0, 13, 1),
                    ("boss_smuggler_captain", 0, 16, 6)]
SCENE_R05 = (SCENE_R05_ROWS, SCENE_R05_KEY, SCENE_R05_ACTORS)

# 거울 호수: 모래 호숫가와 버드나무, 흐르는 호수 물(연잎)과 굳은 거울 수면, 난간 두른 거울 다리,
# 안개 풀밭의 갈대 벽(조약돌 더미 바로 북쪽의 갈대 빈틈이 숨은 길), 징검돌, 메아리 바위, 섬 풀
SCENE_R06_ROWS = [
    "WWWW;;WWRRRRRgRRRRRR",
    "W;;;;;W.R:::::p::::R",
    ";;....;.R::::::::::R",
    "........::::::::::::",
    "..E....-----mmmmmmmm",
    ".......=====mmmmmmmm",
    "~~~~...-----mmmm;;;;",
    "~l~~o~~mmmmmmm;;;;;W",
    "~~~~~o~~lmmmm;;;;;;;",
]
SCENE_R06_KEY = {".": "lake_shore", ";": "island_grass", ":": "mist_grass", "~": "lake_water", "m": "mirror_water",
                 "W": "willow_tree", "R": "lake_reed", "g": "reed_gap", "p": "pebble_cairn", "o": "lake_stepping_stone",
                 "=": "lake_bridge", "-": "bridge_rail", "l": "lily_pad", "E": "echo_rock"}
SCENE_R06_ACTORS = [("player", 4, 5, 3), ("nuri", 4, 4, 3), ("npc_lake_keeper", 0, 2, 2),
                    ("npc_merchant", 0, 1, 1), ("monster_call_frog", 0, 6, 2), ("monster_zip_eel", 0, 2, 7),
                    ("monster_lambda_heron", 0, 10, 5), ("monster_nesting_lily", 0, 16, 2),
                    ("monster_memo_moth", 0, 11, 3), ("obj_rune", 1, 3, 3), ("obj_campfire", 0, 0, 3),
                    ("obj_chest", 0, 13, 0), ("obj_sign", 0, 7, 3), ("obj_board", 0, 4, 1),
                    ("boss_mirror_twins", 0, 12, 4), ("boss_lake_echo", 0, 16, 6)]
SCENE_R06 = (SCENE_R06_ROWS, SCENE_R06_KEY, SCENE_R06_ACTORS)

# 모래시계 사막: 모래 언덕 벽과 붉은 사암 협곡(낙타 해골 바로 북쪽의 사암 틈이 숨은 길), 흰 포석 길, 오아시스와 야자,
# 선인장, 반쯤 묻힌 모래시계, 별자리 판석과 무너진 기둥, 모래 수로를 건너는 널다리(가운데는 고장 난 다리), 금테 제단
SCENE_R07_ROWS = [
    "^^^##g##^^^^^^^^===^",
    "^..#.s.#..T....h===_",
    "^.......y..~~~..===_",
    "::::::::::~~~T::+++_",
    "^...h.......:...===_",
    "^^**I***^^..:.y.===_",
    "^***I***^^.....^===_",
    "^^^^^^^^^^^^^^^^===^",
]
SCENE_R07_KEY = {".": "desert_sand", ":": "desert_path", "^": "desert_dune", "#": "sandstone_wall",
                 "g": "sandstone_gap", "s": "camel_skull", "~": "oasis_water", "T": "palm_tree", "y": "cactus",
                 "I": "ruin_pillar", "*": "star_floor", "=": "sand_canal", "+": "canal_bridge", "_": "altar_floor",
                 "h": "buried_hourglass"}
SCENE_R07_ACTORS = [("player", 4, 5, 3), ("nuri", 4, 4, 3), ("npc_caravan_guide", 0, 2, 2),
                    ("npc_hourglass_keeper", 0, 9, 2), ("monster_sand_stream", 0, 7, 3),
                    ("monster_dune_snail", 0, 6, 1), ("monster_mirage_lizard", 0, 13, 4),
                    ("monster_sieve_urn", 0, 3, 6), ("monster_sundial_crab", 0, 11, 6),
                    ("monster_caravan_ghost", 0, 14, 1), ("monster_dust_devil", 0, 10, 4),
                    ("obj_bridge_broken", 0, 17, 3), ("obj_rune", 1, 1, 4), ("obj_campfire", 0, 0, 2),
                    ("obj_chest", 0, 4, 0), ("obj_sign", 0, 9, 1), ("obj_board", 0, 2, 4)]
SCENE_R07 = (SCENE_R07_ROWS, SCENE_R07_KEY, SCENE_R07_ACTORS)


def subset(manifest, keep, tiles=None):
    """미리보기용 매니페스트 사본: keep(이름)이 참인 스프라이트·초상화와 tiles(없으면 keep)로 고른 타일만."""
    tiles = tiles or keep
    out = dict(manifest)
    out["tilesets"] = {k: {**t, "tiles": [n for n in t["tiles"] if tiles(n)]} for k, t in manifest["tilesets"].items()}
    out["sprites"] = {k: v for k, v in manifest["sprites"].items() if keep(k)}
    out["portraits"] = {k: v for k, v in manifest["portraits"].items() if keep(k)}
    return out


def render_preview(manifest, assets, scene_def=SCENE_R01):
    S = 4
    ts = manifest["tileSize"]
    W = 1200
    blocks = []  # (높이, 그리기 함수)
    pad = 16

    def section(title):
        def draw(c, y):
            text(c, title, pad, y, 2, HEAD)
        blocks.append((18, draw))

    # 1) 타일: 이름과 함께 한 칸씩
    tset = manifest["tilesets"]["overworld"]
    section("tiles/overworld.png  (16x16, 4x)")
    names = tset["tiles"]
    cell_w, cell_h = ts * S + 12, ts * S + 14
    per_row = (W - 2 * pad) // cell_w

    def draw_tiles(c, y):
        for i, n in enumerate(names):
            x = pad + (i % per_row) * cell_w
            yy = y + (i // per_row) * cell_h
            t = Canvas(ts, ts)
            if n in DECO_UNDER:  # 투명 물체 타일은 게임처럼 바닥 위에 올려 보여 준다
                t.draw(TILES[DECO_UNDER[n]])
            t.draw(TILES[n])
            c.paste(t, x, yy, S)
            text(c, n, x, yy + ts * S + 3, 1)
    blocks.append((-(-len(names) // per_row) * cell_h + 4, draw_tiles))

    # 2) 캐릭터: 시트 그대로(아래·왼쪽·오른쪽·위 × 2)
    chars = [n for n in manifest["sprites"] if not n.startswith(("monster_", "obj_", "boss_"))]
    section("characters  (old 16x16: down/left/right/up x2 | new 16x24: down 0 1 3, left, right 0 1, up, blink)")
    # 새 형식(24프레임)에서 고르는 8프레임: 아래 서기·왼발·오른발, 왼쪽, 오른쪽 서기·왼발, 위, 아래 깜빡임
    NEW_PICK = (0, 1, 3, 6, 12, 13, 18, 5)

    def char_h(n):
        return manifest["sprites"][n]["frameHeight"] * S + 8

    def draw_chars(c, y):
        yy = y
        for n in chars:
            spr = manifest["sprites"][n]
            frames = sprite_frames(n)
            if len(frames) == 24:
                frames = [frames[i] for i in NEW_PICK]
            text(c, n, pad, yy + 28, 2)
            for i, f in enumerate(frames):
                fr = Canvas(spr["frameWidth"], spr["frameHeight"]).draw(f)
                x = pad + 170 + i * (spr["frameWidth"] * S + 10)
                c.fill_rect(x - 2, yy - 2, spr["frameWidth"] * S + 4, spr["frameHeight"] * S + 4, PANEL)
                c.paste(fr, x, yy, S)
            # 실제 크기(1x)도 함께
            c.paste(assets[spr["file"]], pad + 170 + 8 * (spr["frameWidth"] * S + 10) + 10, yy + 8, 1)
            yy += char_h(n)
    blocks.append((sum(char_h(n) for n in chars) + 4, draw_chars))

    # 3) 몬스터·오브젝트: 2 또는 4프레임
    small = [n for n in manifest["sprites"] if n.startswith(("monster_", "obj_"))]
    most = max((len(sprite_frames(n)) for n in small), default=2)
    per_line = 4 if most <= 2 else 2
    section(f"monsters / objects  ({'2' if most <= 2 else '2 or 4'} frames)")
    col_w = (W - 2 * pad) // per_line
    row_h = ts * S + 24

    def draw_small(c, y):
        for k, n in enumerate(small):
            spr = manifest["sprites"][n]
            x = pad + (k % per_line) * col_w
            yy = y + (k // per_line) * row_h
            frames = sprite_frames(n)
            for i, f in enumerate(frames):
                fr = Canvas(spr["frameWidth"], spr["frameHeight"]).draw(f)
                fx = x + i * (spr["frameWidth"] * S + 10)
                c.fill_rect(fx - 2, yy - 2, spr["frameWidth"] * S + 4, spr["frameHeight"] * S + 4, PANEL)
                c.paste(fr, fx, yy, S)
            c.paste(assets[spr["file"]], x + len(frames) * (spr["frameWidth"] * S + 10) + 4, yy + 24, 1)
            text(c, n, x, yy + spr["frameHeight"] * S + 6, 1)
    blocks.append((-(-len(small) // per_line) * row_h + 4, draw_small))

    # 4) 보스와 초상화(보스가 한 줄을 넘으면 다음 줄로)
    bosses = [n for n in manifest["sprites"] if n.startswith("boss_")]
    portraits = list(manifest["portraits"])
    boss_frames = max((len(sprite_frames(n)) for n in bosses), default=2)
    section(f"boss (32x32 x{boss_frames})")
    boss_step = 32 * S + 10
    boss_lines = []
    x = pad
    for n in bosses:
        need = len(sprite_frames(n)) * boss_step
        if x + need > W - pad and x > pad:
            x = pad
        boss_lines.append((n, x, 0 if not boss_lines else (boss_lines[-1][2] + (1 if x == pad else 0))))
        x += need
    boss_line_count = (boss_lines[-1][2] + 1) if boss_lines else 1

    def draw_big(c, y):
        for n, x0, line in boss_lines:
            spr = manifest["sprites"][n]
            yy = y + line * (32 * S + 20)
            x = x0
            for f in sprite_frames(n):
                fr = Canvas(spr["frameWidth"], spr["frameHeight"]).draw(f)
                c.fill_rect(x - 2, yy - 2, spr["frameWidth"] * S + 4, spr["frameHeight"] * S + 4, PANEL)
                c.paste(fr, x, yy, S)
                x += spr["frameWidth"] * S + 10
            text(c, n, x0, yy + spr["frameHeight"] * S + 6, 1)
    blocks.append((boss_line_count * (32 * S + 20), draw_big))

    psize = max((p["size"] for p in manifest["portraits"].values()), default=0)
    PS = 3  # 대화창과 같은 배율
    if psize:
        section(f"portraits ({psize}x{psize}, 3x)  nuri: neutral / happy / worried / surprised / serious")

    def draw_portraits(c, y):
        x = pad
        for n in portraits:
            size = manifest["portraits"][n]["size"]
            g = portrait_grid(n)
            c.fill_rect(x - 2, y - 2, size * PS + 4, size * PS + 4, PANEL)
            c.paste(Canvas(size, size).draw(g), x, y, PS)
            text(c, n.removeprefix("portrait_"), x, y + size * PS + 6, 1)
            x += size * PS + 10
        # 실제 크기(1x)
        for k, n in enumerate(portraits):
            size = manifest["portraits"][n]["size"]
            g = Canvas(size, size).draw(portrait_grid(n))
            c.paste(g, x + 8 + (k % 2) * (size + 6), y + (k // 2) * (size + 6), 1)
    if psize:
        blocks.append((max(psize * PS, 3 * (psize + 6)) + 20, draw_portraits))

    # 5) 장면 예시(2x): 타일 위에 캐릭터·오브젝트를 올려 어울림 확인
    section("sample scene (2x)")
    scene, key, actors = scene_def

    def draw_scene(c, y):
        sc = Canvas(len(scene[0]) * ts, len(scene) * ts)
        for j, row in enumerate(scene):
            for i, ch in enumerate(row):
                n = key[ch]
                if n in DECO_UNDER:  # 투명 물체 타일 밑에는 장면의 바닥('.')이나 기본 바닥을 깐다
                    sc.draw(TILES[key.get(".", DECO_UNDER[n])], i * ts, j * ts)
                sc.draw(TILES[n], i * ts, j * ts)
        # 키 큰 스프라이트(16×24 캐릭터)는 발이 칸 바닥에 오게 위로 올리고, 아래 줄부터 그려 겹침을 맞춘다
        for name, frame, tx, ty in sorted(actors, key=lambda a: a[3]):
            g = scene_frame(name, frame)
            dy = len(g) - ts if len(g[0]) == ts and len(g) > ts else 0
            sc.draw(g, tx * ts, ty * ts - dy)
        c.paste(sc, pad, y, 2)
    blocks.append((len(scene) * ts * 2 + 8, draw_scene))

    H = pad + sum(h + 8 for h, _ in blocks) + pad
    c = Canvas(W, H, BG)
    y = pad
    for h, draw in blocks:
        draw(c, y)
        y += h + 8
    return c


def build(write: bool = True):
    """모든 산출물을 {절대 경로: PNG 바이트}로 만든다. write=True면 파일로 쓴다."""
    manifest = load_manifest()
    assets = render_assets(manifest)
    out = {}
    for rel, c in assets.items():
        out[os.path.join(ASSETS, rel)] = encode_png(c.width, c.height, c.rows())
    r01 = subset(manifest, lambda n: n not in R02_NAMES and n not in R03_NAMES and n not in R04_NAMES
                 and n not in R05_NAMES and n not in R06_NAMES and n not in R07_NAMES and n not in TOWN_NAMES)
    prev = render_preview(r01, assets)
    out[PREVIEW] = encode_png(prev.width, prev.height, prev.rows())
    r02 = subset(manifest, lambda n: n in R02_NAMES or n in ("player", "nuri"), lambda n: n in R02_NAMES)
    prev = render_preview(r02, assets, SCENE_R02)
    out[PREVIEW_R02] = encode_png(prev.width, prev.height, prev.rows())
    r03 = subset(manifest, lambda n: n in R03_NAMES or n in ("player", "nuri"), lambda n: n in R03_NAMES)
    prev = render_preview(r03, assets, SCENE_R03)
    out[PREVIEW_R03] = encode_png(prev.width, prev.height, prev.rows())
    r04 = subset(manifest, lambda n: n in R04_NAMES or n in ("player", "nuri"), lambda n: n in R04_NAMES)
    prev = render_preview(r04, assets, SCENE_R04)
    out[PREVIEW_R04] = encode_png(prev.width, prev.height, prev.rows())
    r05 = subset(manifest, lambda n: n in R05_NAMES or n in ("player", "nuri"), lambda n: n in R05_NAMES)
    prev = render_preview(r05, assets, SCENE_R05)
    out[PREVIEW_R05] = encode_png(prev.width, prev.height, prev.rows())
    r06 = subset(manifest, lambda n: n in R06_NAMES or n in ("player", "nuri"), lambda n: n in R06_NAMES)
    prev = render_preview(r06, assets, SCENE_R06)
    out[PREVIEW_R06] = encode_png(prev.width, prev.height, prev.rows())
    r07 = subset(manifest, lambda n: n in R07_NAMES or n in ("player", "nuri"), lambda n: n in R07_NAMES)
    prev = render_preview(r07, assets, SCENE_R07)
    out[PREVIEW_R07] = encode_png(prev.width, prev.height, prev.rows())
    if write:
        for path, data in out.items():
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
    return out


if __name__ == "__main__":
    files = build(write=True)
    for p in sorted(files):
        print(os.path.relpath(p, ROOT))
    print(f"{len(files)} files written")
