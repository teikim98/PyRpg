"""도트 아트 검사: assets/manifest.json의 모든 파일이 있고, 계약대로의 픽셀 크기인지 확인한다.

규칙(src/contracts/assets.ts 주석과 같다)
- 타일셋: 너비 = columns × tileSize, 높이 = ceil(타일 수 / columns) × tileSize
- 캐릭터(player, nuri, npc_*): 프레임 8개(아래·왼쪽·오른쪽·위 × 2) → 너비 = 8 × frameWidth
- 몬스터·오브젝트(monster_*, obj_*): 프레임 2개, 16×16
- 보스(boss_*): 프레임 2개, 32×32
- 초상화: size × size
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

GROUND_TILES = {"grass", "grass_flower", "path", "plaza_stone", "water", "house_wall", "house_roof",
                "wall_stone", "floor_wood", "floor_stone", "stairs", "clocktower_wall", "dark_floor"}


def frame_rule(name: str):
    """(프레임 수, 프레임 너비, 프레임 높이) 또는 None(규칙 없음)."""
    if name in ("player", "nuri") or name.startswith("npc_"):
        return 8, 16, 16
    if name.startswith(("monster_", "obj_")):
        return 2, 16, 16
    if name.startswith("boss_"):
        return 2, 32, 32
    return None


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
            if t in GROUND_TILES and any(p[3] != 255 for p in px):
                errors.append(f"tile {t}: ground tile has transparent pixels")
            if all(p[3] == 0 for p in px):
                errors.append(f"tile {t}: empty")

    for name, spr in manifest["sprites"].items():
        rule = frame_rule(name)
        fw, fh = spr["frameWidth"], spr["frameHeight"]
        if rule is None:
            errors.append(f"sprite {name}: no sheet rule for this name")
            continue
        count, rw, rh = rule
        if (fw, fh) != (rw, rh):
            errors.append(f"sprite {name}: manifest frame {fw}x{fh}, rule says {rw}x{rh}")
        rows = check_file(spr["file"], count * fw, fh)
        if rows is None:
            continue
        for i in range(count):
            if frame_empty(rows, i * fw, 0, fw, fh):
                errors.append(f"sprite {name}: frame {i} is empty")

    for name, por in manifest["portraits"].items():
        s = por["size"]
        rows = check_file(por["file"], s, s)
        if rows is not None and frame_empty(rows, 0, 0, s, s):
            errors.append(f"portrait {name}: empty")

    # 매니페스트에 없는 PNG가 assets/에 남아 있지 않은지
    listed = {os.path.normpath(t["file"]) for t in manifest["tilesets"].values()}
    listed |= {os.path.normpath(s["file"]) for s in manifest["sprites"].values()}
    listed |= {os.path.normpath(p["file"]) for p in manifest["portraits"].values()}
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
