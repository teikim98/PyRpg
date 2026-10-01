"""지역 맵 생성기 공용 코드: 아스키 도면 → Tiled JSON(.tmj), 걸어서 닿는 범위 계산, 진행 순서 검증, CLI.

지역마다 tools/maps/build_rNN.py가 도면·문자표·오브젝트·진행 단계를 RegionSpec으로 정의하고 run()을 부른다.

출력 레이어
  ground     바닥·건물 벽 같은 바탕 타일
  deco       나무·덤불·바위 같은 물체(바탕 위에 겹쳐 그림)
  collision  막힌 칸(값이 0이 아니면 막힘, 보이지 않는 레이어). manifest의 blocking으로 계산하고
             숨겨진 통로 덤불(passable_override 문자)만 뺀다. 엔진은 이 레이어가 있으면 이 레이어를 따른다.
  objects    오브젝트(name = 오브젝트 ID, type = 종류, properties = 명세 §4의 속성)
"""
from __future__ import annotations

import json
import sys
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "assets" / "manifest.json"
TILESET = "overworld"
TS = 16
# 길을 막지 않는 오브젝트 종류(src/game/grid.ts PASSABLE_OBJECT_TYPES와 같다)
NON_BLOCKING = {"trigger", "spawn"}
D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

# 문자 → (오브젝트 ID, 종류, 속성, 밑바닥 강제(선택))
ObjectDef = tuple[str, str, dict, "str | None"]
# 진행 단계: (이 단계에서 제거하는 오브젝트, 이 단계에서 닿아야 하는 것, 아직 닿으면 안 되는 것)
Stage = tuple["str | None", list[str], list[str]]


@dataclass
class RegionSpec:
    region: str
    out: Path
    map_text: str
    tiles: dict[str, tuple[str, str]]  # 문자 → (타일 이름, 레이어)
    objects: dict[str, ObjectDef]
    floors: set[str]  # 오브젝트·데코 밑에 깔 바닥을 이웃에서 고를 때 후보가 되는 바닥 타일
    deco_under: Callable[[str, str, list[str], int, int], str]  # (타일 이름, 문자, 도면, x, y) → 밑바닥
    passable_override: set[str] = field(default_factory=set)
    floor_alias: dict[str, str] = field(default_factory=dict)  # 이웃 바닥을 셀 때 같은 바닥으로 볼 타일
    default_floor: str = "grass"
    # 맵에 넣을 타일셋 타일 수(None = manifest 전체). 지역 1은 타일셋이 늘어도 맵 파일이 바뀌지 않게 24로 고정
    tile_limit: int | None = None
    start: str = "spawn"


def prop(name: str, value) -> dict:
    t = "bool" if isinstance(value, bool) else "int" if isinstance(value, int) else "string"
    return {"name": name, "type": t, "value": value}


def parse_rows(spec: RegionSpec) -> list[str]:
    rows = [r for r in spec.map_text.strip("\n").split("\n")]
    width = len(rows[0])
    for y, r in enumerate(rows):
        if len(r) != width:
            raise SystemExit(f"row {y}: length {len(r)} != {width}")
        for x, ch in enumerate(r):
            if ch not in spec.tiles and ch not in spec.objects:
                raise SystemExit(f"unknown char {ch!r} at ({x},{y})")
    return rows


def neighbor_floor(spec: RegionSpec, rows: list[str], x: int, y: int) -> str:
    """오브젝트·데코 밑에 깔 바닥: 이웃 8칸에서 가장 많은 바닥 타일(상하좌우는 2배로 센다)."""
    counts: dict[str, int] = {}
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= ny < len(rows) and 0 <= nx < len(rows[0]):
                ch = rows[ny][nx]
                if ch in spec.tiles:
                    name, layer = spec.tiles[ch]
                    name = spec.floor_alias.get(name, name)
                    if layer == "ground" and name in spec.floors:
                        w = 2 if dx == 0 or dy == 0 else 1
                        counts[name] = counts.get(name, 0) + w
    if not counts:
        return spec.default_floor
    return max(sorted(counts), key=lambda k: counts[k])


def build(spec: RegionSpec, manifest: dict) -> tuple[dict, list[str], dict]:
    ts = manifest["tilesets"][TILESET]
    names: list[str] = ts["tiles"][: spec.tile_limit] if spec.tile_limit else ts["tiles"]
    blocking = set(ts["blocking"])
    rows = parse_rows(spec)
    h, w = len(rows), len(rows[0])
    gid = {n: i + 1 for i, n in enumerate(names)}

    ground = [0] * (w * h)
    deco = [0] * (w * h)
    collision = [0] * (w * h)
    objects: list[dict] = []
    seen: set[str] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            i = y * w + x
            if ch in spec.objects:
                oid, otype, props, under = spec.objects[ch]
                if oid in seen:
                    raise SystemExit(f"duplicate object {oid}")
                seen.add(oid)
                ground[i] = gid[under or neighbor_floor(spec, rows, x, y)]
                objects.append(
                    {
                        "id": len(objects) + 1,
                        "name": oid,
                        "type": otype,
                        "x": x * TS,
                        "y": y * TS,
                        "width": TS,
                        "height": TS,
                        "rotation": 0,
                        "visible": True,
                        "properties": [prop(k, v) for k, v in props.items()],
                    }
                )
                continue
            name, layer = spec.tiles[ch]
            if layer == "ground":
                ground[i] = gid[name]
            else:
                ground[i] = gid[spec.deco_under(name, ch, rows, x, y)]
                deco[i] = gid[name]
            if ch not in spec.passable_override and name in blocking:
                collision[i] = gid[name]
    missing = [v[0] for v in spec.objects.values() if v[0] not in seen]
    if missing:
        raise SystemExit(f"objects not placed: {missing}")

    def layer(lid: int, name: str, data: list[int], visible: bool = True) -> dict:
        return {
            "id": lid,
            "name": name,
            "type": "tilelayer",
            "x": 0,
            "y": 0,
            "width": w,
            "height": h,
            "opacity": 1,
            "visible": visible,
            "data": data,
        }

    tmj = {
        "type": "map",
        "version": "1.10",
        "tiledversion": "1.11.2",
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "infinite": False,
        "width": w,
        "height": h,
        "tilewidth": TS,
        "tileheight": TS,
        "compressionlevel": -1,
        "nextlayerid": 5,
        "nextobjectid": len(objects) + 1,
        "properties": [prop("region", spec.region)],
        "tilesets": [
            {
                "firstgid": 1,
                "name": TILESET,
                # 엔진은 이 경로를 쓰지 않고 assets/manifest.json의 같은 이름 타일셋을 쓴다(Tiled 편집기용)
                "image": "../../../assets/" + ts["file"],
                "imagewidth": ts["columns"] * TS,
                "imageheight": -(-len(names) // ts["columns"]) * TS,
                "tilewidth": TS,
                "tileheight": TS,
                "tilecount": len(names),
                "columns": ts["columns"],
                "margin": 0,
                "spacing": 0,
                "tiles": [
                    {"id": i, "type": n, "properties": [prop("blocking", n in blocking)]} for i, n in enumerate(names)
                ],
            }
        ],
        "layers": [
            layer(1, "ground", ground),
            layer(2, "deco", deco),
            layer(3, "collision", collision, visible=False),
            {
                "id": 4,
                "name": "objects",
                "type": "objectgroup",
                "draworder": "topdown",
                "x": 0,
                "y": 0,
                "opacity": 1,
                "visible": True,
                "objects": objects,
            },
        ],
    }
    pos = {o["name"]: (o["x"] // TS, o["y"] // TS) for o in objects}
    info = {"pos": pos, "objects": objects, "collision": collision, "w": w, "h": h, "rows": rows,
            "ground": ground, "deco": deco, "names": names, "start": spec.start}
    return tmj, rows, info


def reachable(info: dict, removed: set[str], extra_block: set[tuple[int, int]] = frozenset()) -> set[tuple[int, int]]:
    """시작 오브젝트에서 걸어서 닿는 칸. removed에 든 오브젝트는 치운 것으로, extra_block 칸은 막힌 것으로 본다."""
    w, h = info["w"], info["h"]
    blocked = {(i % w, i // w) for i, v in enumerate(info["collision"]) if v}
    for o in info["objects"]:
        if o["type"] not in NON_BLOCKING and o["name"] not in removed:
            blocked.add(info["pos"][o["name"]])
    blocked |= set(extra_block)
    start = info["pos"][info["start"]]
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in D4:
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in blocked and n not in seen:
                seen.add(n)
                q.append(n)
    return seen


def touches(info: dict, area: set, oid: str) -> bool:
    """오브젝트 칸이나 그 상하좌우 칸에 닿을 수 있는지(막는 오브젝트는 옆 칸에서 상호작용한다)."""
    x, y = info["pos"][oid]
    if (x, y) in area:
        return True
    return any((x + dx, y + dy) in area for dx, dy in D4)


def validate_stages(info: dict, stages: list[Stage], optional: set[str], verbose: bool) -> list[str]:
    """구역이 순서대로 열리는지: 단계마다 닿아야 할 것은 닿고, 뒤 단계의 것은 아직 닿지 않아야 한다."""
    errors: list[str] = []
    removed: set[str] = set()
    for k, (remove, must, must_not) in enumerate(stages):
        if remove:
            removed.add(remove)
        area = reachable(info, removed)
        for oid in must:
            if not touches(info, area, oid):
                errors.append(f"after removing {remove}: {oid} should be reachable")
        later = set(must_not) | {o for _, m, _ in stages[k + 1 :] for o in m}
        for oid in sorted(later):
            if touches(info, area, oid):
                errors.append(f"after removing {remove}: {oid} should NOT be reachable yet")
        if verbose:
            print(f"  stage remove={remove}: {len(area)} tiles reachable")
    if removed & optional:
        errors.append("optional monsters must not be needed on the main path")
    return errors


def removed_before(stages: list[Stage], oid: str) -> set[str]:
    """oid가 처음 닿아야 하는 단계까지 치운 오브젝트들."""
    out: set[str] = set()
    for remove, must, _ in stages:
        if remove:
            out.add(remove)
        if oid in must:
            return out
    raise KeyError(oid)



def check_runes_before_monsters(info: dict, stages: list[Stage], region_dir: Path) -> list[str]:
    """몬스터가 요구하는 이 지역 주문서의 비석은 그 몬스터보다 먼저(몬스터를 치우기 전에) 닿아야 한다.
    아니면 주문서 없이 길목에 막혀 진행할 수 없다(need_scroll). 이전 지역의 주문서는 이미 가진 것으로 본다."""
    errors: list[str] = []
    rune_of = {}
    for lj in sorted((region_dir / "lessons").glob("*/lesson.json")):
        lesson = json.loads(lj.read_text(encoding="utf-8"))
        rune_of[lesson["scroll"]["id"]] = f"rune_{lesson['id']}"
    for o in info["objects"]:
        if o["type"] != "monster":
            continue
        oid = o["name"]
        pid = next(p["value"] for p in o.get("properties", []) if p["name"] == "problem")
        problem = json.loads((region_dir / "problems" / pid / "problem.json").read_text(encoding="utf-8"))
        area = reachable(info, removed_before(stages, oid) - {oid})
        for scroll in problem.get("requires", []):
            rune = rune_of.get(scroll)
            if rune and not touches(info, area, rune):
                errors.append(f"{oid} needs {scroll}, but {rune} is not reachable before {oid}")
    return errors

def dump(tmj: dict, width: int) -> str:
    """JSON으로 쓰되 타일 데이터는 맵 한 줄을 한 줄로 쓴다(diff를 읽기 쉽게)."""
    rows: dict[str, str] = {}
    for layer in tmj["layers"]:
        if "data" in layer:
            key = f"@@{layer['name']}@@"
            d = layer["data"]
            lines = [",".join(str(v) for v in d[i : i + width]) for i in range(0, len(d), width)]
            rows[key] = "[\n   " + ",\n   ".join(lines) + "\n  ]"
            layer["data"] = key
    text = json.dumps(tmj, ensure_ascii=False, indent=1)
    for key, val in rows.items():
        text = text.replace(f'"{key}"', val)
    return text + "\n"


def run(spec: RegionSpec, validate: Callable[[dict, bool], list[str]], script: str) -> int:
    """CLI: [--check] [--print]. 검증에 실패하면 1, --check에서 파일이 다르면 1."""
    args = set(sys.argv[1:])
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    tmj, rows, info = build(spec, manifest)
    if "--print" in args:
        print("\n".join(rows))
        print(f"size {info['w']}x{info['h']}, objects {len(info['objects'])}")
    errors = validate(info, "--print" in args)
    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1
    text = dump(tmj, info["w"])
    if "--check" in args:
        if not spec.out.exists() or spec.out.read_text(encoding="utf-8") != text:
            print(f"map.tmj is out of date; run {script}", file=sys.stderr)
            return 1
        print("map.tmj OK")
        return 0
    spec.out.parent.mkdir(parents=True, exist_ok=True)
    spec.out.write_text(text, encoding="utf-8")
    print(f"wrote {spec.out.relative_to(ROOT)} ({info['w']}x{info['h']}, {len(info['objects'])} objects)")
    return 0
