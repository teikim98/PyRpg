"""지역 3 보스(32×32 프레임 2개): 고블린 족장.

보물 왕관(금, 빨강·청록 보석)을 쓰고, 가슴에는 지역 1·2 보스와 같은 청록 문자판의 시계 룬 목걸이를 건 고블린 족장.
어깨에 털 깃, 등에 빨간 망토, 성난 눈썹과 아래턱 송곳니. 몸은 왼쪽 절반(16칸)만 그리고 좌우를 맞춘 뒤
비대칭 장식(망토 자락, 왕관 보석, 왕홀)을 얹는다.
프레임 A는 노려보고, 프레임 B는 눈이 붉게 빛나고 입을 벌리며 목걸이 문자판이 밝아지고 왕홀을 치켜든다.
"""
from cavepal import color_outline, paint, shade_right
from gridlib import overlay

SIZE = 32

_HALF = """
    ................
    ..........G....H
    ..........GH..GH
    .........gGg.gGH
    .........gGGgGGG
    .........gTgGgrG
    .........uuuuuuu
    ........34555555
    .4.....345555555
    .54...3455555555
    ..55433455511555
    ...4433455yy1155
    ....333445ye4455
    .....33444444444
    .....334444W3333
    .....234444Wkkkk
    ......2334444444
    ....FFf223333333
    ..FFFFFfffffffff
    .xFFfbbbbbbbcbcc
    xxXbb33bbbbbcCDD
    xXb3344bbbbcCDdL
    xXb3344bbbbcDddL
    xXb3344bbbbcDddd
    xX.3344bbbbbcDDD
    xX.4554bbbbbbccc
    xX.3443mmmmmmmmm
    zx..22.qqqqQQQqq
    zx.....qqQQqqqqq
    zz.....qqqq..qqq
    .......2223..222
    ................
"""

LEGEND = {
    "1": "n1", "2": "n2", "3": "n3", "4": "n4", "5": "n5",
    "G": "g4", "g": "g3", "H": "g5", "u": "g1", "r": "r2", "T": "i3",
    "y": "g4", "e": "eye", "W": "b4", "k": "r0",
    "F": "b3", "f": "b2", "b": "w2", "c": "g2", "C": "g4",
    "D": "i2", "d": "i3", "L": "i0",
    "x": "r1", "X": "r2", "z": "r0",
    "m": "w1", "q": "q1", "Q": "q2",
}
AWAKE = {**LEGEND, "y": "r3", "e": "r0", "d": "i4", "D": "i3"}


def _rows(half: str):
    rows = [r.strip() for r in half.strip("\n").splitlines() if r.strip()]
    return "\n".join(r + r[::-1] for r in rows)


def _chief(awake: bool):
    body = paint(_rows(_HALF), AWAKE if awake else LEGEND, SIZE, SIZE)
    if awake:
        # 입을 크게 벌린다(아래 한 줄 더 어둡게)
        mouth = paint("""
            kkkkkkkk
            .kkkkkk.
        """, {"k": "r0"}, 8, 2)
        body = overlay(body, mouth, 12, 16)
    # 왕관 가운데 큰 보석(빨강)과 망토 자락(오른쪽만 늘어진다)
    gem = paint("""
        .R.
        RrR
        .r.
    """, {"R": "r3", "r": "r2"}, 3, 3)
    body = overlay(body, gem, 15, 3)
    # 문자판의 시침(오른쪽 아래로, 멈춘 시각)
    hand = paint("LL", {"L": "i0"}, 2, 1)
    body = overlay(body, hand, 17, 22)
    body = shade_right(body, 19)
    g = color_outline(body)
    # 왕홀: 오른손(그림 오른쪽)에 금 막대, 끝에 청록 룬 구슬. 프레임 B는 한 칸 들어 올린다
    lift = 3 if awake else 0
    scepter = color_outline(paint("""
        ..dd..
        .dLdd.
        .dddD.
        ..DD..
        ..gG..
        ..gG..
        ..gG..
        ..gG..
        ..gG..
        ..gG..
        ..uG..
        ..uG..
        ..ug..
        ..ug..
    """, {"d": "i3", "L": "i5", "D": "i2", "g": "g3", "G": "g4", "u": "g2"}, 6, 14))
    g = overlay(g, scepter, 25, 11 - lift)
    # 주먹이 왕홀을 쥔다(왕홀 위에 다시 손)
    fist = color_outline(paint("""
        .44.
        4543
        3443
    """, {"3": "n3", "4": "n4", "5": "n5"}, 4, 3))
    g = overlay(g, fist, 25, 22 - lift)
    return g


CAVE_BOSSES = {"boss_goblin_chief": [_chief(False), _chief(True)]}
