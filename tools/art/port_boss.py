"""지역 5 보스(32×32 프레임 2개): 밀수꾼 선장.

금테를 두른 검은 삼각모, 한쪽 눈의 안대, 갈색 수염, 빨간 깃을 세운 남색 긴 외투(금단추), 흰 셔츠,
빨간 허리띠에 매단 청록 문자판의 시계 룬(지역 1~4 보스와 같은 문자판), 오른손(그림 오른쪽)에 쥔 빨간 장부.
몸은 왼쪽 절반(16칸)만 그리고 좌우를 맞춘 뒤 비대칭 장식(안대, 시계 룬, 장부, 허리에 짚은 손)을 얹는다.
프레임 A는 장부를 낀 채 노려보고, 프레임 B는 장부를 치켜들고 시계 룬과 남은 눈이 밝아진다.
"""
from gridlib import overlay
from portpal import color_outline, paint, shade_right, sym

SIZE = 32

_HALF = """
    ................
    ................
    ....k...........
    ....kk.......kkk
    ....kLk....kkKKK
    ....kLKkkkkKKKKK
    ....kKLKKKKKKLLK
    .....kKKKKKKKKKK
    .....GgKKKKKKKKK
    ......GGgggggggG
    ..........hsssGG
    ..........hsssss
    ..........hsesss
    ..........hsssSs
    ..........hhhhhh
    .......nn.hhHhhh
    .....nqQQnhhhhhh
    ....nqQQQRhhhhhW
    ...nqQQQQRRhhhWW
    ...nqQQBQQRhHhWW
    ...nqQQQQQRRWWWw
    ...nqQQBQQQRWWWw
    ...nqQQQQQQRWWWw
    ...nqRRRRRRRRRRR
    ...SsrrrrrrrrrGG
    ...SsQQQQQQnPPPP
    ....nqQQQQnPPPp.
    ....nqQQQQnPPPp.
    .....nnnnnnPPPp.
    .........xXxxx..
    ........xXXxxx..
    ........xxxxxx..
"""

LEGEND = {
    "k": "k2", "K": "k3", "L": "k4",
    "G": "g4", "g": "g3", "B": "g4",
    "s": "s3", "S": "s2", "e": "eye",
    "h": "h2", "H": "h3",
    "Q": "q3", "q": "q2", "n": "q1",
    "R": "r3", "r": "r2",
    "W": "a4", "w": "a3",
    "P": "a2", "p": "a1",
    "x": "k1", "X": "k3",
}
AWAKE = {**LEGEND, "e": "i4"}

_DIAL = """
    .hGGh.
    hDdDDh
    GDLDDG
    GDLLDG
    hDDDDh
    .hGGh.
"""
DIAL_KEY = {"h": "g2", "G": "g4", "D": "i2", "d": "i4", "L": "i0"}
DIAL_AWAKE = {**DIAL_KEY, "D": "i3", "d": "i5"}

# 안대(왼쪽 위에서 오른쪽 아래로 끈이 지나간다)
_PATCH = """
    ...k...
    ....k..
    ...kkkk
    ...kkkk
    ....kk.
"""
PATCH_KEY = {"k": "k0"}

# 장부: 빨간 표지에 금 모서리, 아래로 종이 단면이 보이는 두꺼운 책
_LEDGER = """
    GRRRRRG
    RrrrrrR
    RrGGGrR
    RrrrrrR
    RrGGrrR
    RrrrrrR
    GRRRRRG
    aAAAAAa
"""
LEDGER_KEY = {"G": "g4", "R": "r3", "r": "r2", "A": "a4", "a": "a2"}


def _captain(awake: bool):
    body = paint(sym(_HALF), AWAKE if awake else LEGEND, SIZE, SIZE)
    # 안대는 그림 오른쪽 눈(몸의 왼쪽 눈)
    body = overlay(body, paint(_PATCH, PATCH_KEY, 7, 5), 16, 9)
    body = shade_right(body, 21)
    g = color_outline(body)
    # 허리띠에 매단 시계 룬(그림 왼쪽)
    g = overlay(g, color_outline(paint(_DIAL, DIAL_AWAKE if awake else DIAL_KEY, 6, 6)), 7, 22)
    # 오른손의 장부. 프레임 B는 네 칸 들어 올린다
    lift = 4 if awake else 0
    ledger = color_outline(paint(_LEDGER, LEDGER_KEY, 7, 8))
    g = overlay(g, ledger, 24, 18 - lift)
    hand = color_outline(paint("""
        sss
        SsS
    """, LEGEND, 3, 2))
    g = overlay(g, hand, 26, 26 - lift)
    return g


PORT_BOSSES = {"boss_smuggler_captain": [_captain(False), _captain(True)]}
