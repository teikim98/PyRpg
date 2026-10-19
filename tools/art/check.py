"""도트 아트 검사: assets/manifest.json의 모든 파일이 있고, 계약대로의 픽셀 크기인지 확인한다.

규칙(src/contracts/assets.ts 주석과 같다. 그래픽 개편 계약은 docs/art-overhaul/plan.md §3)
- 타일셋: 너비 = columns × tileSize, 높이 = ceil(타일 수 / columns) × tileSize
- 캐릭터(player, nuri, npc_*): 새 형식 16×24 프레임 6열 × 4행(행 = 아래·왼쪽·오른쪽·위,
  열 = 서기·왼발·서기·오른발·숨쉬기·깜빡임) → 96×96. 옛 형식 16×16 가로 8프레임(128×16)도 통과
- 몬스터·오브젝트(monster_*, obj_*): 16×16 가로 2 또는 4프레임. obj_chest·obj_door는 [닫힘, 열림] 2프레임만
- 보스(boss_*): 32×32 가로 2 또는 4프레임
- 초상화(portrait_*): 64×64(manifest size = 64)
- manifest `tileAnimations`(선택): { 타일: { frames: [타일, 프레임 타일…], fps: 양수 } }. 프레임 타일은 타일셋에
  있어야 하고 키 타일보다 뒤(끝에 추가)에 있어야 한다. 바닥 타일의 애니메이션 프레임도 불투명해야 한다
- manifest `edgeDecor`(선택, 결정 20): 조각 시트(16×16, columns칸)가 있고, 조각 이름이 `<묶음>_<방향>`이며 빈 조각이 없는지,
  terrain의 타일이 overworld 타일셋에 있는지, 규칙의 분류가 terrain에 있고 묶음마다 조각이 하나 이상인지
추가로 PNG가 RGBA(컬러 타입 6)인지, 바닥 타일이 완전히 불투명한지, 빈 프레임이 없는지,
build.py로 다시 만든 결과가 디스크의 파일과 바이트 단위로 같은지(결정적 빌드) 확인한다.

    python3 tools/art/check.py
"""
import math
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build  # noqa: E402
from png import read_png  # noqa: E402

PORTRAIT_SIZE = 64  # src/contracts/assets.ts: 초상화 64×64

GROUND_TILES = {"grass", "grass_flower", "path", "plaza_stone", "water", "house_wall", "house_roof",
                "wall_stone", "floor_wood", "floor_stone", "stairs", "clocktower_wall", "dark_floor",
                # 지역 2(갈림길 숲)
                "forest_floor", "fallen_leaves", "tall_grass", "root_floor", "stream", "stepping_stone",
                # 지역 3(고블린 동굴): 바닥·벽 앞면·벽 윗면·웅덩이·레일과 벽 앞면 변형(횃불·벽화·바위 틈)
                "cave_floor", "cave_wall", "cave_wall_top", "torch_frozen", "cave_pool", "mural_wall", "cave_crack",
                "minecart_rail",
                # 지역 4(무너진 대도서관): 마루·카펫·떠 있는 페이지, 벽 앞면·윗면, 칸을 채우는 책장과 빈 책장 칸
                "lib_floor", "lib_carpet", "floating_pages", "lib_wall", "lib_wall_top", "bookshelf", "shelf_gap",
                # 지역 5(교역항): 자갈길·부두 널·갑판·바다·굳은 파도, 칸을 채우는 등대 벽
                "port_cobble", "dock_plank", "ship_deck", "harbor_water", "frozen_wave", "lighthouse_wall",
                # 지역 6(거울 호수): 호숫가·섬 풀·안개 풀·다리 널·흐르는 물·거울 수면·물 위 징검돌
                "lake_shore", "island_grass", "mist_grass", "lake_bridge", "lake_water", "mirror_water",
                "lake_stepping_stone"}

# 지역 2 명세(docs/phase3/region02-spec.md §6): 타일셋 끝에 이 순서로 붙고, 이 중 일부는 막힌다
R02_TILES = ["forest_floor", "fallen_leaves", "tall_grass", "stump", "log", "mushroom_patch", "stream",
             "stepping_stone", "signpost_fork", "pine_tree", "moss_stone", "root_floor"]
R02_BLOCKING = {"stump", "log", "stream", "signpost_fork", "pine_tree", "moss_stone"}
R02_SPRITES = {"monster_fork_sprout", "monster_leap_owl", "monster_loop_snake", "monster_count_shroom",
               "monster_hail_wisp", "monster_acorn_mite", "boss_crossroad_tree", "npc_traveler", "npc_woodcutter"}
# 지역 3 명세(docs/phase3/region03-spec.md §6): 지역 2 타일 뒤에 이 순서로 붙는다. cave_crack은 지나갈 수 있다
R03_TILES = ["cave_floor", "cave_wall", "cave_wall_top", "torch_frozen", "crystal", "rubble", "treasure_pile",
             "cave_pool", "mural_wall", "cave_crack", "minecart_rail", "bone_pile"]
R03_BLOCKING = {"cave_wall", "cave_wall_top", "torch_frozen", "crystal", "rubble", "treasure_pile", "cave_pool",
                "mural_wall", "bone_pile"}
R03_SPRITES = {"monster_index_goblin", "monster_slice_bat", "monster_stack_crab", "monster_mirror_slime",
               "monster_grid_golem", "boss_goblin_chief", "npc_goblin"}
# 지역 4 명세(docs/phase3/region04-spec.md §7): 지역 3 타일 뒤에 이 순서로 붙는다. shelf_gap 등은 지나갈 수 있다
R04_TILES = ["lib_floor", "lib_carpet", "lib_wall", "lib_wall_top", "bookshelf", "bookshelf_fallen", "book_pile",
             "reading_desk", "candle_frozen", "broken_pillar", "floating_pages", "shelf_gap"]
R04_BLOCKING = {"lib_wall", "lib_wall_top", "bookshelf", "bookshelf_fallen", "book_pile", "reading_desk",
                "candle_frozen", "broken_pillar"}
R04_SPRITES = {"monster_letter_moth", "monster_ink_slime", "monster_quill_sprite", "monster_scroll_snake",
               "monster_cipher_owl", "boss_librarian_golem", "npc_ghost_librarian"}
# 지역 5 명세(docs/phase3/region05-spec.md §6): 지역 4 타일 뒤에 이 순서로 붙는다. crate_gap·rope_coil 등은 지나갈 수 있다.
# 명세의 crate·market_stall은 지역 1 타일과 이름이 겹쳐 port_crate·port_stall로 붙였다
R05_TILES = ["port_cobble", "dock_plank", "harbor_water", "frozen_wave", "pier_post", "port_crate", "crate_gap", "barrel",
             "rope_coil", "fishing_net", "ship_deck", "ship_rail", "port_stall", "lighthouse_wall"]
R05_BLOCKING = {"harbor_water", "frozen_wave", "pier_post", "port_crate", "barrel", "fishing_net", "ship_rail",
                "port_stall", "lighthouse_wall"}
R05_SPRITES = {"monster_twin_fish", "monster_ledger_gull", "monster_bubble_jelly", "monster_tally_parrot",
               "monster_queue_crab", "boss_smuggler_captain", "npc_guild_master"}
# 지역 6 명세(docs/phase3/region06-spec.md §6): 지역 5 타일 뒤에 이 순서로 붙는다. reed_gap·pebble_cairn 등은 지나갈 수 있다.
# 명세의 stepping_stone은 지역 2 타일과 이름이 겹쳐 lake_stepping_stone으로 붙였다
R06_TILES = ["lake_shore", "lake_water", "mirror_water", "lake_reed", "reed_gap", "pebble_cairn", "lake_stepping_stone",
             "lake_bridge", "bridge_rail", "willow_tree", "lily_pad", "mist_grass", "echo_rock", "island_grass"]
R06_BLOCKING = {"lake_water", "mirror_water", "lake_reed", "bridge_rail", "willow_tree", "lily_pad", "echo_rock"}
R06_SPRITES = {"monster_call_frog", "monster_zip_eel", "monster_lambda_heron", "monster_nesting_lily",
               "monster_memo_moth", "boss_mirror_twins", "boss_lake_echo", "npc_lake_keeper"}
# 지역 1 타일 24종의 인덱스는 바뀌면 안 된다(지역 1 맵이 gid로 참조)
R01_TILE_COUNT = 24


# 프레임 두 개가 [닫힘, 열림]으로 정해진 오브젝트(4프레임으로 늘리지 않는다)
TWO_STATE_OBJECTS = {"obj_chest", "obj_door"}


def frame_rules(name: str):
    """허용하는 시트 형식 목록: [(프레임 너비, 프레임 높이, 가로 칸 수, 세로 칸 수)]. 규칙이 없으면 [].

    - 캐릭터(player, nuri, npc_*): 새 형식 16×24 6열 × 4행(24프레임) 또는 옛 형식 16×16 가로 8프레임
    - 몬스터·오브젝트(monster_*, obj_*): 16×16 가로 2 또는 4프레임(obj_chest·obj_door는 2프레임만)
    - 보스(boss_*): 32×32 가로 2 또는 4프레임
    """
    if name in ("player", "nuri") or name.startswith("npc_"):
        return [(16, 24, 6, 4), (16, 16, 8, 1)]
    if name in TWO_STATE_OBJECTS:
        return [(16, 16, 2, 1)]
    if name.startswith(("monster_", "obj_")):
        return [(16, 16, 2, 1), (16, 16, 4, 1)]
    if name.startswith("boss_"):
        return [(32, 32, 2, 1), (32, 32, 4, 1)]
    return []


def check_tile_animations(manifest, errors):
    """manifest `tileAnimations`(최상위, 타일셋 overworld 기준) 또는 타일셋 안의 `tileAnimations` 형식 검사.

    형식: { "<타일 이름>": { "frames": ["<타일 이름>", "<프레임 타일>", ...], "fps": <양수> } }
    - 키 타일과 모든 프레임 타일이 그 타일셋에 있어야 한다. frames는 2개 이상이고 첫 프레임은 키 타일이다.
    - 키가 아닌 프레임 타일은 타일셋 끝쪽(키 타일보다 뒤)에 있어야 한다(기존 순서·맵 데이터 불변).
    돌려주는 값: 바닥 타일 애니메이션의 프레임 타일 이름 집합(불투명 검사에 더한다).
    """
    ground_frames = set()
    tables = []
    if "tileAnimations" in manifest:
        tables.append(("overworld", manifest["tileAnimations"]))
    for tname, tset in manifest["tilesets"].items():
        if "tileAnimations" in tset:
            tables.append((tname, tset["tileAnimations"]))
    for tname, anims in tables:
        where = f"tileAnimations({tname})"
        if not isinstance(anims, dict):
            errors.append(f"{where}: must be an object")
            continue
        tset = manifest["tilesets"].get(tname)
        if tset is None:
            errors.append(f"{where}: no tileset {tname!r}")
            continue
        tiles = tset["tiles"]
        for key, anim in anims.items():
            if not isinstance(anim, dict):
                errors.append(f"{where}.{key}: must be an object with frames and fps")
                continue
            if key not in tiles:
                errors.append(f"{where}.{key}: tile {key!r} not in tileset")
            frames = anim.get("frames")
            fps = anim.get("fps")
            if not isinstance(frames, list) or len(frames) < 2 or not all(isinstance(f, str) for f in frames):
                errors.append(f"{where}.{key}: frames must be a list of 2+ tile names")
                frames = []
            elif frames[0] != key:
                errors.append(f"{where}.{key}: first frame must be {key!r}, got {frames[0]!r}")
            if isinstance(fps, bool) or not isinstance(fps, (int, float)) or not fps > 0:
                errors.append(f"{where}.{key}: fps must be a positive number, got {fps!r}")
            extra = set(anim) - {"frames", "fps"}
            if extra:
                errors.append(f"{where}.{key}: unknown fields {sorted(extra)}")
            for f in frames:
                if f not in tiles:
                    errors.append(f"{where}.{key}: frame tile {f!r} not in tileset")
                elif f != key and key in tiles and tiles.index(f) < tiles.index(key):
                    errors.append(f"{where}.{key}: frame tile {f!r} must come after {key!r} (append at the end)")
            if key in GROUND_TILES:
                ground_frames |= {f for f in frames if f in tiles}
    return ground_frames


EDGE_DIRS = ("n", "s", "w", "e", "nw", "ne", "sw", "se")


def check_edge_decor(manifest, errors):
    """manifest `edgeDecor` 형식 검사(파일 크기·빈 조각은 main에서). 돌려주는 값: 조각 이름 목록."""
    decor = manifest.get("edgeDecor")
    if decor is None:
        return []
    extra = set(decor) - {"file", "columns", "pieces", "terrain", "rules"}
    if extra:
        errors.append(f"edgeDecor: unknown fields {sorted(extra)}")
    pieces = decor.get("pieces")
    if not isinstance(pieces, list) or not pieces or not all(isinstance(p, str) for p in pieces):
        errors.append("edgeDecor.pieces must be a non-empty list of names")
        return []
    if len(set(pieces)) != len(pieces):
        errors.append("edgeDecor.pieces has duplicates")
    for p in pieces:
        if "_" not in p or p.rsplit("_", 1)[1] not in EDGE_DIRS:
            errors.append(f"edgeDecor.pieces: {p!r} must be <set>_<n|s|w|e|nw|ne|sw|se>")
    if not isinstance(decor.get("columns"), int) or decor["columns"] <= 0:
        errors.append("edgeDecor.columns must be a positive integer")
    tiles = set(manifest["tilesets"]["overworld"]["tiles"])
    terrain = decor.get("terrain", {})
    for t, cls in terrain.items():
        if t not in tiles:
            errors.append(f"edgeDecor.terrain: tile {t!r} not in overworld tileset")
        if not isinstance(cls, str) or not cls:
            errors.append(f"edgeDecor.terrain.{t}: class must be a non-empty string")
    classes = set(terrain.values())
    sets = {p.rsplit("_", 1)[0] for p in pieces}
    for i, r in enumerate(decor.get("rules", [])):
        for key in ("from", "onto"):
            for cls in r.get(key, []):
                if cls not in classes:
                    errors.append(f"edgeDecor.rules[{i}].{key}: class {cls!r} has no tiles in terrain")
        if r.get("pieces") not in sets:
            errors.append(f"edgeDecor.rules[{i}]: no pieces named {r.get('pieces')!r}_<dir>")
        if set(r.get("from", [])) & set(r.get("onto", [])):
            errors.append(f"edgeDecor.rules[{i}]: from and onto overlap (every inner cell would get an edge)")
    return pieces


def color_type(path):
    with open(path, "rb") as f:
        head = f.read(33)
    return struct.unpack(">IIBB", head[16:26])[3]


def main():
    manifest = build.load_manifest()
    errors = []
    checked = 0

    def check_file(rel, w, h):
        nonlocal checked
        path = os.path.join(build.ASSETS, rel)
        if not os.path.isfile(path):
            errors.append(f"missing: assets/{rel}")
            return None
        ct = color_type(path)
        if ct != 6:
            errors.append(f"assets/{rel}: color type {ct}, expected 6 (RGBA)")
        pw, ph, rows = read_png(path)
        if (pw, ph) != (w, h):
            errors.append(f"assets/{rel}: {pw}x{ph}, expected {w}x{h}")
            return None
        checked += 1
        print(f"ok  assets/{rel}  {pw}x{ph}")
        return rows

    def frame_empty(rows, x0, y0, fw, fh):
        return all(rows[y][x][3] == 0 for y in range(y0, y0 + fh) for x in range(x0, x0 + fw))

    ts = manifest["tileSize"]
    anim_ground = check_tile_animations(manifest, errors)
    for tname, tset in manifest["tilesets"].items():
        cols = tset["columns"]
        n = len(tset["tiles"])
        rows = check_file(tset["file"], cols * ts, math.ceil(n / cols) * ts)
        if rows is None:
            continue
        for b in tset["blocking"]:
            if b not in tset["tiles"]:
                errors.append(f"tileset {tname}: blocking tile {b!r} not in tiles")
        for i, t in enumerate(tset["tiles"]):
            x0, y0 = (i % cols) * ts, (i // cols) * ts
            px = [rows[y][x] for y in range(y0, y0 + ts) for x in range(x0, x0 + ts)]
            if (t in GROUND_TILES or t in anim_ground) and any(p[3] != 255 for p in px):
                errors.append(f"tile {t}: ground tile has transparent pixels")
            if all(p[3] == 0 for p in px):
                errors.append(f"tile {t}: empty")

    edge_pieces = check_edge_decor(manifest, errors)
    if edge_pieces and isinstance(manifest["edgeDecor"].get("columns"), int) and manifest["edgeDecor"]["columns"] > 0:
        decor = manifest["edgeDecor"]
        cols = decor["columns"]
        rows = check_file(decor["file"], cols * ts, math.ceil(len(edge_pieces) / cols) * ts)
        if rows is not None:
            for i, p in enumerate(edge_pieces):
                if frame_empty(rows, (i % cols) * ts, (i // cols) * ts, ts, ts):
                    errors.append(f"edge piece {p}: empty")

    ow = manifest["tilesets"]["overworld"]
    if ow["tiles"][R01_TILE_COUNT:R01_TILE_COUNT + len(R02_TILES)] != R02_TILES:
        errors.append("overworld: region-2 tiles must follow the 24 region-1 tiles in spec order")
    for t in R02_TILES:
        if (t in ow["blocking"]) != (t in R02_BLOCKING):
            errors.append(f"overworld: tile {t} blocking should be {t in R02_BLOCKING}")
    for name in sorted(R02_SPRITES - set(manifest["sprites"])):
        errors.append(f"sprite {name}: missing from manifest (region-2 spec §6)")
    r03_at = R01_TILE_COUNT + len(R02_TILES)
    if ow["tiles"][r03_at:r03_at + len(R03_TILES)] != R03_TILES:
        errors.append("overworld: region-3 tiles must follow the region-2 tiles in spec order")
    for t in R03_TILES:
        if (t in ow["blocking"]) != (t in R03_BLOCKING):
            errors.append(f"overworld: tile {t} blocking should be {t in R03_BLOCKING}")
    for name in sorted(R03_SPRITES - set(manifest["sprites"])):
        errors.append(f"sprite {name}: missing from manifest (region-3 spec §6)")
    r04_at = r03_at + len(R03_TILES)
    if ow["tiles"][r04_at:r04_at + len(R04_TILES)] != R04_TILES:
        errors.append("overworld: region-4 tiles must follow the region-3 tiles in spec order")
    for t in R04_TILES:
        if (t in ow["blocking"]) != (t in R04_BLOCKING):
            errors.append(f"overworld: tile {t} blocking should be {t in R04_BLOCKING}")
    for name in sorted(R04_SPRITES - set(manifest["sprites"])):
        errors.append(f"sprite {name}: missing from manifest (region-4 spec §7)")
    r05_at = r04_at + len(R04_TILES)
    if ow["tiles"][r05_at:r05_at + len(R05_TILES)] != R05_TILES:
        errors.append("overworld: region-5 tiles must follow the region-4 tiles in spec order")
    for t in R05_TILES:
        if (t in ow["blocking"]) != (t in R05_BLOCKING):
            errors.append(f"overworld: tile {t} blocking should be {t in R05_BLOCKING}")
    for name in sorted(R05_SPRITES - set(manifest["sprites"])):
        errors.append(f"sprite {name}: missing from manifest (region-5 spec §6)")
    r06_at = r05_at + len(R05_TILES)
    if ow["tiles"][r06_at:r06_at + len(R06_TILES)] != R06_TILES:
        errors.append("overworld: region-6 tiles must follow the region-5 tiles in spec order")
    for t in R06_TILES:
        if (t in ow["blocking"]) != (t in R06_BLOCKING):
            errors.append(f"overworld: tile {t} blocking should be {t in R06_BLOCKING}")
    for name in sorted(R06_SPRITES - set(manifest["sprites"])):
        errors.append(f"sprite {name}: missing from manifest (region-6 spec §6)")

    for name, spr in manifest["sprites"].items():
        rules = frame_rules(name)
        fw, fh = spr["frameWidth"], spr["frameHeight"]
        if not rules:
            errors.append(f"sprite {name}: no sheet rule for this name")
            continue
        sizes = [r for r in rules if (r[0], r[1]) == (fw, fh)]
        if not sizes:
            allowed = ", ".join(sorted({f"{r[0]}x{r[1]}" for r in rules}))
            errors.append(f"sprite {name}: manifest frame {fw}x{fh}, rule allows {allowed}")
            continue
        path = os.path.join(build.ASSETS, spr["file"])
        if not os.path.isfile(path):
            errors.append(f"missing: assets/{spr['file']}")
            continue
        pw, ph, _ = read_png(path)
        rule = next((r for r in sizes if (r[2] * fw, r[3] * fh) == (pw, ph)), None)
        if rule is None:
            allowed = ", ".join(f"{r[2] * fw}x{r[3] * fh} ({r[2] * r[3]} frames)" for r in sizes)
            errors.append(f"sprite {name}: sheet {pw}x{ph}, expected one of {allowed}")
            continue
        _, _, cols, nrows = rule
        rows = check_file(spr["file"], cols * fw, nrows * fh)
        if rows is None:
            continue
        for i in range(cols * nrows):
            if frame_empty(rows, (i % cols) * fw, (i // cols) * fh, fw, fh):
                errors.append(f"sprite {name}: frame {i} is empty")

    for name, por in manifest["portraits"].items():
        s = por["size"]
        if s != PORTRAIT_SIZE:
            errors.append(f"portrait {name}: manifest size {s}, contract says {PORTRAIT_SIZE}")
        rows = check_file(por["file"], s, s)
        if rows is not None and frame_empty(rows, 0, 0, s, s):
            errors.append(f"portrait {name}: empty")

    # 매니페스트에 없는 PNG가 assets/에 남아 있지 않은지
    listed = {os.path.normpath(t["file"]) for t in manifest["tilesets"].values()}
    listed |= {os.path.normpath(s["file"]) for s in manifest["sprites"].values()}
    listed |= {os.path.normpath(p["file"]) for p in manifest["portraits"].values()}
    if manifest.get("edgeDecor", {}).get("file"):
        listed.add(os.path.normpath(manifest["edgeDecor"]["file"]))
    for dirpath, _, files in os.walk(build.ASSETS):
        for f in files:
            if f.endswith(".png"):
                rel = os.path.normpath(os.path.relpath(os.path.join(dirpath, f), build.ASSETS))
                if rel not in listed:
                    errors.append(f"unlisted PNG: assets/{rel}")

    # 결정적 빌드: 다시 만든 바이트가 디스크와 같아야 한다
    for path, data in build.build(write=False).items():
        rel = os.path.relpath(path, build.ROOT)
        if not os.path.isfile(path):
            errors.append(f"not built yet: {rel} (run tools/art/build.py)")
            continue
        with open(path, "rb") as f:
            if f.read() != data:
                errors.append(f"stale or non-deterministic: {rel} differs from a fresh build")

    if errors:
        print("\nFAILED")
        for e in errors:
            print("  -", e)
        return 1
    print(f"\nall {checked} manifest files OK; rebuild is byte-identical")
    return 0


if __name__ == "__main__":
    sys.exit(main())
