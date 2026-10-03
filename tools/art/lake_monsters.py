"""지역 6(거울 호수) 몬스터 5종(16×16 프레임 2개).

몸통은 외곽선 없이 칠한 뒤 color_outline()으로 재질에 맞는 색 외곽선을 두른다(누리의 화풍).
대칭인 몸은 왼쪽 절반(8칸)만 그리고 sym()으로 좌우를 맞춘다. 빛은 왼쪽 위에서 온다.
지역 1~5 몬스터와 실루엣이 겹치지 않게:
부름 개구리는 낮고 넓은 정면 몸에 오른쪽으로 길게 뻗는 분홍 혀, 지퍼 장어는 위아래 두 마리가 금빛 이빨로 맞물린
가로로 긴 띠(머리 둘이 왼쪽에 나란하고 꼬리는 오른쪽에서 벌어진다. 지역 5 쌍둥이 물고기의 나비넥타이 모양과 다르다),
람다 왜가리는 옆모습의 키 큰 새로 다리가 λ 모양으로 꺾였고, 겹연꽃 정령은 연꽃 안에 연꽃이 세 겹 든 컵 모양,
쪽지 나방은 날개를 접어 위를 향한 삼각형(지역 4 글자 나방은 날개를 활짝 편 정면)에 날개마다 쪽지가 핀으로 꽂혀 있다.
"""
from gridlib import overlay
from lakepal import CH, color_outline, paint, shade_right, sym

# ── 부름 개구리(함수 호출과 return): 낮고 넓은 연두 개구리. 프레임 A는 혀를 오른쪽으로 길게 뻗고(호출),
# 프레임 B는 혀를 되감아 금빛 구슬(돌려받은 값)을 입가에 물었다 ─────────────────────────────
FROG_KEY = {"5": "j5", "4": "j4", "3": "j3", "2": "j2", "1": "j1", "W": "white", "e": "eye",
            "B": "a4", "b": "a3", "P": "p4", "p": "p3", "q": "p2", "G": "g4", "g": "g3", "Y": "g5", "m": "p2"}

_FROG_BODY = """
    ................
    ................
    ................
    ..44....44......
    .4WW4..4WW4.....
    .4We4..4We4.....
    345W4444W443....
    444444444444....
    4mmmmmmmmmm3....
    45BBBBBBBB34....
    45BBBBBBbB33....
    44BbBBBbbb33....
    34BbbbbbbB32....
    .3442bb2443.....
    553......355....
    ................
"""
_TONGUE_OUT = paint("""
    ................
    ................
    ................
    ................
    ................
    ................
    ................
    ..............pP
    ...........qPPPP
    ..............pp
    ................
    ................
    ................
    ................
    ................
    ................
""", FROG_KEY, 16, 16)
_TONGUE_BACK = paint("""
    ................
    ................
    ................
    ................
    ................
    ..............Y.
    .............Y..
    ...........YGG..
    ...........qGg..
    ...........qp...
    ................
    ................
    ................
    ................
    ................
    ................
""", FROG_KEY, 16, 16)


def _call_frog(back: bool):
    g = paint(_FROG_BODY, FROG_KEY, 16, 16)
    if back:
        # 혀를 되감으며 몸을 한 칸 웅크린다(눈을 반쯤 감는다)
        g = ["." * 16] + g[:-1]
        g = [r.replace(CH["eye"], CH["j2"]) for r in g]
    g = shade_right(g, 8, skip=("eye", "white", "a4"))
    g = color_outline(g)
    return color_outline(overlay(g, _TONGUE_BACK if back else _TONGUE_OUT))


# ── 지퍼 장어(zip): 남보라 장어(위)와 주황 장어(아래)가 나란히 헤엄치며 사이의 금빛 이빨이 지퍼처럼 맞물렸다.
# 머리 둘은 왼쪽에 나란하고, 오른쪽 꼬리 쪽은 아직 잠기지 않아 위아래로 벌어진다. 프레임 B는 몸이 한 칸 물결친다 ──
EEL_KEY = {"A": "z5", "B": "z4", "C": "z3", "D": "z2", "a": "o5", "b": "o4", "c": "o3", "d": "o2",
           "G": "g4", "g": "g2", "e": "eye", "W": "white"}
_EEL = [
    "................",
    "................",
    "................",
    "..BB..A...A.....",
    ".BBBBBBBBBBBB...",
    "BWeBBBBBBBBBBCC.",
    "BBCCCCCCCCCCCDDC",
    ".DDDDDDDDDDDDD..",
    "..G.G.G.G.G.G...",
    "...g.g.g.g.g.g..",
    ".bbbbbbbbbbbbb..",
    "bWebbbbbbbbbbcc.",
    "bbcccccccccccddc",
    ".dddddddddddd...",
    "..dd..a...a.....",
    "................",
]


def _zip_eel(phase: int):
    """띠를 열마다 위아래로 한 칸씩 물결치게 옮긴다(프레임 B는 물결이 두 칸 앞으로 간다)."""
    base = paint("\n".join(_EEL), EEL_KEY, 16, 16)
    cols = []
    for x in range(16):
        dy = (0, 0, -1, -1, 0, 0, 1, 1)[(x + 2 * phase) % 8] if x >= 3 else 0
        col = [base[y][x] for y in range(16)]
        if dy:
            col = col[-dy:] + col[:-dy]  # 위(-1)나 아래(+1)로 한 칸(맨 위·아래 줄은 비어 있다)
        cols.append(col)
    g = ["".join(cols[x][y] for x in range(16)) for y in range(16)]
    return color_outline(g)


# ── 람다 왜가리(lambda·정렬): 옆모습(왼쪽을 봄)의 흰 왜가리. 검은 댕기 깃, 긴 노란 부리, 회색 날개 끝.
# 긴 다리 하나가 몸에서 오른쪽 아래로 곧게 내려가고 짧은 다리가 그 가운데서 왼쪽 아래로 꺾여 λ가 된다.
# 프레임 B는 목을 앞으로 내밀어 부리로 물을 찌른다 ─────────────────────────────────
HERON_KEY = {"5": "a5", "4": "a4", "3": "a3", "2": "a2", "1": "a1", "k": "k2", "K": "k3", "e": "eye",
             "Y": "y4", "y": "g3", "L": "y3", "l": "y2", "W": "n5", "w": "n4"}

_HERON_A = """
    ....kkk.........
    ...k4455........
    YYYy4e45........
    ....4554........
    .....45.........
    ......45........
    ......45........
    .....4543.......
    .....45443322...
    ......4443322KK.
    .......3322KK...
    ........L.......
    .........L......
    ........l.L.....
    .......l...L....
    .....lll...LLL..
"""
_HERON_B = """
    ................
    ................
    ................
    ................
    ...kkk..........
    ..k4455.........
    ..4e4554........
    .yy...454.......
    Yy.....4543322..
    Y......4443322KK
    ........3322KK..
    ........L.......
    .W.......L......
    WwW.....l.L.....
    .......l...L....
    .....lll...LLL..
"""


def _lambda_heron(strike: bool):
    g = paint(_HERON_B if strike else _HERON_A, HERON_KEY, 16, 16)
    return color_outline(g)


# ── 겹연꽃 정령(재귀): 큰 분홍 연꽃 안에 작은 연꽃, 그 안에 더 작은 하얀 연꽃 봉오리. 가운데 연꽃에 눈이 있고
# 연잎 받침 위에 떠 있다. 프레임 B는 바깥 꽃잎이 벌어지며 안쪽 연꽃들이 한 칸씩 솟는다 ─────────────────
LILY_KEY = {"5": "p5", "4": "p4", "3": "p3", "2": "p2", "1": "p1", "W": "white", "e": "eye",
            "E": "e5", "F": "e4", "f": "e3", "d": "e2", "G": "g4", "b": "blush"}

_OUTER_A = sym("""
    ........
    ........
    ........
    ........
    ........
    ........
    ........
    .3......
    .43.....
    .433....
    .4333...
    ..43333.
    ..433333
    ..dFFFFF
    .dfFEEEE
    ..ddffff
""")
_OUTER_B = sym("""
    ........
    ........
    ........
    ........
    ........
    ........
    3.......
    43......
    433.....
    .433....
    .4333...
    ..433333
    ..433333
    ..dFFFFF
    .dfFEEEE
    ..ddffff
""")
# 가운데 연꽃(연분홍)과 맨 안쪽 봉오리(흰 분홍). 각자 외곽선을 둘러 겹이 또렷하게 보인다
_MIDDLE = sym("""
    .4..4
    .4.44
    44444
    4e445
    .4b44
""")
_INNER = sym("""
    .5
    55
    5W
""")


def _nesting_lily(bloom: bool):
    g = paint(_OUTER_B if bloom else _OUTER_A, {**LILY_KEY, "3": "p2", "4": "p3"}, 16, 16)
    g = shade_right(g, 9, skip=("eye", "white", "p5", "blush"))
    g = color_outline(g)
    rise = 1 if bloom else 0
    mid = color_outline(shade_right(paint(_MIDDLE, LILY_KEY, 10, 5), 6, skip=("p5",)))
    g = overlay(g, mid, 3, 7 - rise)
    inner = color_outline(paint(_INNER, LILY_KEY, 4, 3))
    return overlay(g, inner, 6, 5 - 2 * rise)


# ── 쪽지 나방(메모): 날개를 접어 위를 향한 삼각형이 된 옅은 보라 나방(위에서 본 모습). 깃털 더듬이, 날개마다
# 금핀으로 꽂은 흰 쪽지(적어 둔 값). 프레임 B는 날개를 살짝 벌리고 쪽지가 팔락인다 ───────────────────
MOTH_KEY = {"6": "u6", "5": "u5", "4": "u4", "3": "u3", "2": "u2", "1": "u1", "k": "k3", "e": "eye",
            "A": "a5", "a": "a3", "G": "g4", "h": "h3", "H": "h4"}

_MOTH_A = sym("""
    ......k.
    .....k.k
    ......kH
    ......hH
    ......4h
    .....45h
    .....45h
    ....454h
    ....453h
    ...4543h
    ...4543h
    ..45432h
    ..45432h
    .454321.
    .43211..
    ........
""")
_MOTH_B = sym("""
    .....k..
    ....k.k.
    ......kH
    ......hH
    .....4.h
    ....45.h
    ....45.h
    ...454.h
    ...453.h
    ..4543.h
    ..4543.h
    .45432.h
    .45432.h
    454321..
    43211...
    ........
""")
_NOTE = paint("""
    G..
    AAa
    AkA
    Aka
""", MOTH_KEY, 3, 4)
_NOTE_TILT = paint("""
    .G.
    AAa
    kAA
    aka
""", MOTH_KEY, 3, 4)


def _memo_moth(open_: bool):
    g = paint(_MOTH_B if open_ else _MOTH_A, MOTH_KEY, 16, 16)
    g = shade_right(g, 8, skip=("eye", "a5", "u6"))
    g = color_outline(g)
    if open_:
        g = overlay(g, _NOTE_TILT, 2, 9)
        g = overlay(g, _NOTE, 11, 8)
    else:
        g = overlay(g, _NOTE, 3, 9)
        g = overlay(g, _NOTE_TILT, 10, 9)
    # 머리의 작은 눈
    return overlay(g, paint("e..e", MOTH_KEY, 4, 1), 6, 4 if not open_ else 4)


LAKE_MONSTERS = {
    "monster_call_frog": [_call_frog(False), _call_frog(True)],
    "monster_zip_eel": [_zip_eel(0), _zip_eel(1)],
    "monster_lambda_heron": [_lambda_heron(False), _lambda_heron(True)],
    "monster_nesting_lily": [_nesting_lily(False), _nesting_lily(True)],
    "monster_memo_moth": [_memo_moth(False), _memo_moth(True)],
}
