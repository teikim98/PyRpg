"""지역 3(고블린 동굴) 몬스터 5종(16×16 프레임 2개).

몸통은 외곽선 없이 칠한 뒤 color_outline()으로 재질에 맞는 색 외곽선을 두른다(누리의 새 화풍).
대칭인 몸은 왼쪽 절반(8칸)만 그리고 sym()으로 좌우를 맞춘다. 빛은 왼쪽 위에서 온다.
"""
from cavepal import color_outline, paint, shade_right
from gridlib import overlay, shift


def sym(half: str) -> str:
    """왼쪽 절반(8칸) 행들 → 좌우 대칭 16칸 행들(문자 그대로 거울)."""
    rows = [r.strip() for r in half.strip("\n").splitlines() if r.strip()]
    return "\n".join(r + r[::-1] for r in rows)


# ── 번호표 고블린: 막대 끝 번호표(-1)를 치켜든 꼬마 고블린. 프레임 B는 몸을 웅크리고 표를 흔든다 ──────
GOBLIN_KEY = {"1": "n1", "2": "n2", "3": "n3", "4": "n4", "5": "n5", "w": "white", "e": "eye", "k": "eye",
              "c": "w2", "C": "w3", "r": "r2", "W": "b3", "T": "b2", "s": "w3", "y": "g4"}

_GOBLIN_BODY = paint(sym("""
    ........
    ........
    ........
    .....334
    4...3455
    54.34555
    .4434555
    ..34we55
    ..33ee44
    ...33444
    ...23wkw
    ....2233
    ...rrCcc
    ..43rCcc
    ...2.22c
    ........
"""), GOBLIN_KEY, 16, 16)

_TAG = paint("""
    WWWWW
    WWWkW
    WkWkW
    WWWkW
    TTTTT
    ..s..
    ..s..
    ..s..
    .44..
""", GOBLIN_KEY, 5, 9)


def _index_goblin(crouch: bool):
    body = shade_right(_GOBLIN_BODY, 10)
    body = shift(body, 0, 1) if crouch else body
    g = overlay(body, _TAG, 10 if crouch else 11, 3 if crouch else 1)
    return color_outline(g)


# ── 자르는 박쥐: 날개 끝이 칼로 자른 듯 곧은 사선(쇠빛 날). 프레임 B는 날개를 들어 올린다 ────────────
BAT_KEY = {"0": "v0", "1": "v1", "2": "v2", "3": "v3", "4": "v4", "N": "m4", "M": "m3", "i": "i4", "I": "i5",
           "w": "white", "p": "r3"}

_BAT_A = paint(sym("""
    ........
    ........
    ........
    .....3..
    .....43.
    N...2344
    1N..2344
    11N.34Ii
    111N3444
    2111N344
    MMMMM234
    .....3w2
    ......22
    ........
    ........
    ........
"""), BAT_KEY, 16, 16)

_BAT_B = paint(sym("""
    ........
    ........
    MMMMM...
    2111N3..
    111N.43.
    11N.2344
    1N..2344
    N...34Ii
    ....3444
    .....344
    .....234
    .....3w2
    ......22
    ........
    ........
    ........
"""), BAT_KEY, 16, 16)

# ── 쌓는 게: 등에 상자를 층층이(위 1개, 아래 2개) 얹은 빨간 게. 프레임 B는 집게를 들고 상자가 한 칸 들썩인다 ──
CRAB_KEY = {"0": "r0", "1": "r1", "2": "r2", "3": "r3", "4": "r4", "e": "eye", "w": "white",
            "a": "w1", "b": "w2", "c": "w3", "d": "w4", "D": "w5", "g": "g3"}

_CRATES = paint("""
    ....DDdd....
    ....dccb....
    ....cgcb....
    ....bbba....
    DDddd.Ddddc.
    dcccbadccbba
    cbgcbacbgcba
    bbbbaabbbbaa
""", CRAB_KEY, 12, 8)

_CRAB_BODY = paint(sym("""
    ........
    ........
    ........
    ........
    ........
    ........
    ........
    ........
    4.......
    34......
    23..3444
    1234we44
    .1233333
    ..122222
    ..1.1.11
    ........
"""), CRAB_KEY, 16, 16)

_CRAB_BODY_B = paint(sym("""
    ........
    ........
    ........
    ........
    ........
    ........
    4.......
    34......
    23......
    12..3444
    .124we44
    ..233333
    ..122222
    ..122222
    ..1.1.11
    ........
"""), CRAB_KEY, 16, 16)


def _stack_crab(up: bool):
    body = _CRAB_BODY_B if up else _CRAB_BODY
    crates = color_outline(_CRATES)
    g = color_outline(shade_right(body, 10))
    # 상자 더미는 등 위(눈자루 뒤)에 얹힌다
    return overlay(g, crates, 2, 0 if up else 1)


# ── 거울 슬라임: 몸 윗부분이 웅덩이처럼 동굴 천장을 거꾸로 비춘다(수면 선, 거꾸로 선 종유석). 프레임 B는 납작 ──
SLIME_KEY = {"0": "p0", "1": "p1", "2": "p2", "3": "p3", "4": "p4", "5": "p5", "e": "eye", "w": "white",
             "c": "c3", "C": "c4", "t": "i3"}

_SLIME_A = paint(sym("""
    ........
    ........
    ........
    ........
    ......54
    ....5444
    ...44333
    ..433c33
    ..3c3cC3
    .4444444
    .3322we2
    .3222ee2
    .2222222
    .1222222
    ..111111
    ........
"""), SLIME_KEY, 16, 16)

_SLIME_B = paint(sym("""
    ........
    ........
    ........
    ........
    ........
    ........
    .....544
    ...54443
    ..43c333
    .43c3cC3
    44444444
    3322we22
    3222ee22
    22222222
    .1111111
    ........
"""), SLIME_KEY, 16, 16)


def _mirror_slime(squash: bool):
    g = _SLIME_B if squash else _SLIME_A
    g = color_outline(shade_right(g, 11))
    # 수면 반짝임(한쪽에만)
    spark = paint("""
        .5.
        545
        .5.
    """, SLIME_KEY, 3, 3)
    return overlay(g, spark, 11 if not squash else 12, 2 if not squash else 4)


# ── 격자 골렘: 몸이 3×3 격자로 나뉜 돌덩이, 청록 눈, 짧은 팔. 프레임 B는 팔을 들고 가운데 칸이 빛난다 ──
GOLEM_KEY = {"0": "c1", "1": "c2", "2": "c3", "3": "c4", "4": "c5", "5": "c6", "i": "i4", "I": "i5", "t": "i2",
             "T": "i3", "m": "d4", "M": "d5"}

_GOLEM_A = paint(sym("""
    ........
    ........
    ....5444
    ....4333
    ....3i3I
    ....3333
    ..544440
    ..4332.5
    3.4332.4
    434222.3
    3.000000
    ..5440.5
    ..4330.4
    ..3220.3
    ...54..5
    ........
"""), GOLEM_KEY, 16, 16)

_GOLEM_B = paint(sym("""
    ........
    ........
    ....5444
    ....4333
    ....3i3I
    ....3333
    43544440
    3.4332.5
    ..4332.4
    ..3222.3
    ..000000
    ..5440.5
    ..4330.4
    ..3220.3
    ...54..5
    ........
"""), GOLEM_KEY, 16, 16)


def _grid_golem(glow: bool):
    g = shade_right(_GOLEM_B if glow else _GOLEM_A, 10)
    if glow:
        core = paint("""
            TT
            Tt
        """, GOLEM_KEY, 2, 2)
        g = overlay(g, core, 7, 11)
    return color_outline(g)


CAVE_MONSTERS = {
    "monster_index_goblin": [_index_goblin(False), _index_goblin(True)],
    "monster_slice_bat": [color_outline(shade_right(_BAT_A, 10)), color_outline(shade_right(_BAT_B, 10))],
    "monster_stack_crab": [_stack_crab(False), _stack_crab(True)],
    "monster_mirror_slime": [_mirror_slime(False), _mirror_slime(True)],
    "monster_grid_golem": [_grid_golem(False), _grid_golem(True)],
}
