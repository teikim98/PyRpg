"""경계 장식 조각(결정 20, style-guide.md §4.2). 16×16, 배경 투명. assets/tiles/edges.png로 묶인다.

타일 한 칸은 이웃을 모르므로 '풀 덤불이 길로 넘어옴'·'물가'를 타일 그림으로는 그릴 수 없다. 그래서 엔진이
맵을 그릴 때 이웃 칸의 분류(manifest `edgeDecor.terrain`)를 보고 이 조각을 바닥 위·물체 아래에 얹는다
(src/game/edgeDecor.ts). 맵 데이터·충돌은 그대로다.

조각 이름 = `<묶음>_<방향>`. 방향은 '넘어오는 이웃이 이 칸의 어느 쪽에 있는가'다.
- n·s·e·w: 그 쪽 이웃이 넘어온다(예: grass_n = 위 칸의 풀이 이 칸 위쪽 가장자리로 늘어짐)
- ne·nw·se·sw: 대각선 이웃만 넘어올 때(양옆 두 칸은 아님) 그 모서리에 작게
묶음에 없는 방향은 엔진이 건너뛴다(예: deck은 n·w·nw만 있다).

묶음
- grass·forest·island·mist: 풀 덤불. 풀 타일의 질감을 그대로 이어 그려서(무늬가 16칸 주기라 위 칸 풀과 이어짐)
  색이 지역마다 달라도 맞는다. 위·왼쪽 풀은 잎 끝 그늘 + 아래(오른쪽)에 잎 그림자 선(빛이 왼쪽 위),
  아래 풀은 잎 끝이 위로 1~2px 솟는다(밝은 끝).
- shore: 밝은 물의 물가. 반투명(bank·foam·shallow)이라 물 색과 상관없이 얹힌다. 위쪽 땅은 둑 그늘 2px +
  물거품 선, 나머지 방향은 끊긴 물거품 선 + 얕은 물.
- shore_dark: 어두운 물(동굴 웅덩이·호수, manifest 분류 water_dark)의 물가. 흰 물거품은 어두운 물 위에서 밝은
  네모 테두리로 읽혀서, 물빛에 가까운 옅은 잔물결 점선(1~2px 조각, 군데군데)과 짙은 둑 그늘만 쓴다.
- deck: 부두·다리·갑판이 물 위에 드리운 그늘(위·왼쪽).
- wall: 벽·지붕 발치 그늘(벽 바로 아래 칸의 위 2px, style-guide.md §3.2 '벽 아래 첫 줄').

모든 무늬는 cozypal.noise(좌표 해시)로 정해 결정적이다.
"""
from cozypal import c, noise
from forest_tiles import FOREST_TILES
from gridlib import PALETTE
from lake_tiles import LAKE_TILES
from tiles import TILES as R01_TILES

T = 16
DIRS = ("n", "s", "w", "e", "nw", "ne", "sw", "se")


def _blank():
    return [["."] * T for _ in range(T)]


def _rows(g):
    return ["".join(r) for r in g]


def _tile_char(tile, hex_):
    """타일 그리드에서 그 hex 색(불투명)을 쓰는 팔레트 문자. 타일의 색만 골라 쓰려고 한다."""
    want = (int(hex_[0:2], 16), int(hex_[2:4], 16), int(hex_[4:6], 16), 255)
    for row in tile:
        for ch in row:
            if PALETTE.get(ch) == want:
                return ch
    raise KeyError(f"color {hex_} not in tile")


# 풀 덤불 묶음: (질감을 따올 타일 그리드, 잎 끝 그늘 색, 잎 그림자 선 색, 솟은 잎 끝 밝은 색, 시드)
_FOREST = FOREST_TILES["forest_floor"]
_ISLAND = LAKE_TILES["island_grass"]
_MIST = LAKE_TILES["mist_grass"]
GRASS_SETS = {
    "grass": (R01_TILES["grass"], c("grass.shade"), c("grass.ol"), c("grass.hi"), 31),
    "forest": (_FOREST, _tile_char(_FOREST, "305c43"), c("leaf.ol"), _tile_char(_FOREST, "54864e"), 37),
    "island": (_ISLAND, _tile_char(_ISLAND, "205c38"), c("grass.ol"), _tile_char(_ISLAND, "529c48"), 41),
    "mist": (_MIST, _tile_char(_MIST, "425450"), c("moss.ol"), _tile_char(_MIST, "80927c"), 43),
}


def _grass_pieces(src, tip, line, hi, seed):
    """풀 덤불 8방향. src[y % 16][x % 16]으로 질감을 이어 그린다."""
    def tex(x, y):
        return src[y % T][x % T]

    out = {}
    # n: 위 칸 풀이 1~3px 늘어지고(2픽셀 폭 덩어리마다 깊이 해시), 끝은 그늘, 그 아래 잎 그림자 선.
    # 짝수 열의 절반은 잎 끝이 1px 더 늘어진다(cozysamples.grass_edge_over_path와 같은 규칙)
    g = _blank()
    for x in range(T):
        depth = 1 + int(noise(x // 2, 0, seed) * 3)
        for y in range(depth - 1):
            g[y][x] = tex(x, y)
        g[depth - 1][x] = tip
        if x % 2 == 0 and noise(x, 1, seed) < 0.5:
            g[depth][x] = tip
            g[depth + 1][x] = line
        else:
            g[depth][x] = line
    out["n"] = g
    # w: 왼쪽 칸 풀이 1~2px 넘어오고, 그 오른쪽에 잎 그림자 선(빛이 왼쪽 위라 그림자는 오른쪽·아래로)
    g = _blank()
    for y in range(T):
        width = 1 + int(noise(0, y // 2, seed + 1) * 2)
        for x in range(width - 1):
            g[y][x] = tex(x, y)
        g[y][width - 1] = tip
        if noise(1, y, seed + 1) < 0.6:
            g[y][width] = line
    out["w"] = g
    # e: 오른쪽 칸 풀이 1~2px 넘어온다. 그림자는 풀 쪽으로 떨어지므로 선 없이 끝만 그늘
    g = _blank()
    for y in range(T):
        width = 1 + int(noise(2, y // 2, seed + 2) * 2)
        for k in range(width - 1):
            g[y][T - 1 - k] = tex(T - 1 - k, y)
        g[y][T - width] = tip
    out["e"] = g
    # s: 아래 칸 풀의 잎 끝이 위로 솟는다(2픽셀 폭 덩어리 중 70%, 높이 1~2px, 맨 위는 밝은 끝)
    g = _blank()
    for x0 in range(0, T, 2):
        if noise(x0, 3, seed + 3) >= 0.7:
            continue
        h = 1 + int(noise(x0, 4, seed + 3) * 2)
        for x in (x0, x0 + 1):
            hh = h if x == x0 or noise(x, 5, seed + 3) < 0.5 else max(1, h - 1)
            for k in range(hh):
                y = T - 1 - k
                g[y][x] = hi if k == hh - 1 else tex(x, y)
    out["s"] = g
    # 모서리(대각선 이웃만 풀): 작은 잎 덩어리
    g = _blank()  # nw: 왼쪽 위 3×2 + 잎 끝·그림자
    for x in range(3):
        g[0][x] = tex(x, 0)
    g[1][0], g[1][1], g[1][2] = tex(0, 1), tip, line
    g[2][0], g[2][1] = tip, line
    g[3][0] = line
    out["nw"] = g
    g = _blank()  # ne: 오른쪽 위
    for x in range(T - 3, T):
        g[0][x] = tex(x, 0)
    g[1][T - 3], g[1][T - 2], g[1][T - 1] = line, tip, tex(T - 1, 1)
    g[2][T - 2], g[2][T - 1] = line, tip
    g[3][T - 1] = line
    out["ne"] = g
    g = _blank()  # sw: 왼쪽 아래 잎 끝 하나
    g[T - 1][0], g[T - 1][1], g[T - 2][0] = tex(0, T - 1), tex(1, T - 1), hi
    out["sw"] = g
    g = _blank()  # se: 오른쪽 아래 잎 끝 하나
    g[T - 1][T - 1], g[T - 1][T - 2], g[T - 2][T - 1] = tex(T - 1, T - 1), tex(T - 2, T - 1), hi
    out["se"] = g
    return out


def _shore_pieces(seed=53):
    """물가 8방향(반투명). 위쪽 땅: 둑 그늘 2px + 물거품 선 + 얕은 물 0~1px.
    나머지 방향: 가장자리 물거품 선(군데군데 끊김) + 안쪽 얕은 물 0~2px(덩어리마다 폭이 달라 테두리처럼 보이지 않게)."""
    bank, foam, shallow = c("bank"), c("foam"), c("shallow")
    out = {}
    g = _blank()
    for x in range(T):
        g[0][x] = g[1][x] = bank
        g[2][x] = foam if noise(x // 2, 0, seed) < 0.6 else shallow
        if noise(x // 3, 6, seed) < 0.6:  # 얕은 물 폭이 2~3칸 덩어리마다 1~2px로 들쭉날쭉
            g[3][x] = foam if g[2][x] == shallow and noise(x, 1, seed) < 0.5 else shallow
    out["n"] = g
    g = _blank()
    for x in range(T):
        g[T - 1][x] = foam if noise(x // 3, 2, seed) < 0.55 else shallow
        for k in range(1, 1 + int(noise(x // 2, 7, seed) * 3)):
            g[T - 1 - k][x] = shallow
    out["s"] = g
    g = _blank()
    for y in range(T):
        g[y][0] = foam if noise(4, y // 3, seed) < 0.55 else shallow
        for k in range(1, 1 + int(noise(8, y // 2, seed) * 3)):
            g[y][k] = shallow
    out["w"] = g
    g = _blank()
    for y in range(T):
        g[y][T - 1] = foam if noise(5, y // 3, seed) < 0.55 else shallow
        for k in range(1, 1 + int(noise(9, y // 2, seed) * 3)):
            g[y][T - 1 - k] = shallow
    out["e"] = g
    g = _blank()  # nw·ne: 둑 그늘 2×2 + 물거품 한 점 + 얕은 물
    g[0][0] = g[0][1] = g[1][0] = g[1][1] = bank
    g[2][0], g[2][1], g[0][2], g[1][2] = shallow, foam, shallow, shallow
    out["nw"] = g
    g = _blank()
    g[0][T - 1] = g[0][T - 2] = g[1][T - 1] = g[1][T - 2] = bank
    g[2][T - 1], g[2][T - 2], g[0][T - 3], g[1][T - 3] = shallow, foam, shallow, shallow
    out["ne"] = g
    g = _blank()  # sw·se: 물거품 ㄴ자 + 얕은 물
    g[T - 1][0] = g[T - 1][1] = g[T - 2][0] = foam
    g[T - 2][1] = shallow
    out["sw"] = g
    g = _blank()
    g[T - 1][T - 1] = g[T - 1][T - 2] = g[T - 2][T - 1] = foam
    g[T - 2][T - 2] = shallow
    out["se"] = g
    return out


def _shore_dark_pieces(seed=59):
    """어두운 물의 물가 8방향. 가장자리에 붙은 선을 만들지 않고, 가장자리에서 1px 안쪽에 짧은 잔물결 조각을
    드문드문 둔다(이어진 선이 없어서 테두리로 읽히지 않음). 위쪽 땅만 둑 그늘 2px."""
    bank, rip = c("bank_dark"), c("ripple_dark")
    out = {}

    def dashes(n, seed_):
        """길이 16 줄에서 잔물결 조각 위치: 3칸마다 35% 확률로 1~2px"""
        on = [False] * T
        for x0 in range(0, T, 3):
            if noise(x0, 0, seed_) < 0.35:
                for k in range(1 + int(noise(x0, 1, seed_) * 2)):
                    if x0 + k < T:
                        on[x0 + k] = True
        if not any(on):  # 한 조각도 없으면 가운데 하나(빈 조각 금지)
            on[7] = on[8] = True
        return on

    g = _blank()
    for x in range(T):
        g[0][x] = g[1][x] = bank
    for x, v in enumerate(dashes(T, seed)):
        if v:
            g[3][x] = rip
    out["n"] = g
    g = _blank()
    for x, v in enumerate(dashes(T, seed + 1)):
        if v:
            g[T - 2][x] = rip
    out["s"] = g
    g = _blank()
    for y, v in enumerate(dashes(T, seed + 2)):
        if v:
            g[y][1] = rip
    out["w"] = g
    g = _blank()
    for y, v in enumerate(dashes(T, seed + 3)):
        if v:
            g[y][T - 2] = rip
    out["e"] = g
    g = _blank()
    g[0][0] = g[0][1] = g[1][0] = g[1][1] = bank
    out["nw"] = g
    g = _blank()
    g[0][T - 1] = g[0][T - 2] = g[1][T - 1] = g[1][T - 2] = bank
    out["ne"] = g
    g = _blank()
    g[T - 2][1] = rip
    out["sw"] = g
    g = _blank()
    g[T - 2][T - 2] = rip
    out["se"] = g
    return out


def _deck_pieces():
    """물 위 구조물(부두·다리·갑판)의 그늘: 위 3px, 왼쪽 2px, 왼쪽 위 모서리 2×3."""
    sh = c("shadow_soft")
    out = {}
    g = _blank()
    for y in range(3):
        for x in range(T):
            g[y][x] = sh
    out["n"] = g
    g = _blank()
    for y in range(T):
        for x in range(2):
            g[y][x] = sh
    out["w"] = g
    g = _blank()
    for y in range(3):
        for x in range(2):
            g[y][x] = sh
    out["nw"] = g
    return out


def _wall_pieces():
    """벽·지붕 발치 그늘: 벽 바로 아래 칸의 위 2px(첫 줄은 진하게, 둘째 줄은 옅게)."""
    g = _blank()
    for x in range(T):
        g[0][x] = c("shadow")
        g[1][x] = c("shadow_soft")
    return {"n": g}


def _build():
    pieces = {}
    for name, (src, tip, line, hi, seed) in GRASS_SETS.items():
        for d, g in _grass_pieces(src, tip, line, hi, seed).items():
            pieces[f"{name}_{d}"] = g
    for prefix, made in (("shore", _shore_pieces()), ("deck", _deck_pieces()), ("wall", _wall_pieces()),
                         ("shore_dark", _shore_dark_pieces())):
        for d, g in made.items():
            pieces[f"{prefix}_{d}"] = g
    # 이름 순서를 방향 순서로 고정(manifest pieces와 같은 순서로 쓰기 쉽게)
    ordered = {}
    # shore_dark는 뒤에 붙인다(앞 조각의 시트 위치가 바뀌지 않게)
    for prefix in [*GRASS_SETS, "shore", "deck", "wall", "shore_dark"]:
        for d in DIRS:
            k = f"{prefix}_{d}"
            if k in pieces:
                ordered[k] = _rows(pieces[k])
    return ordered


EDGE_PIECES = _build()
