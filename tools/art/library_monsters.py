"""지역 4(무너진 대도서관) 몬스터 5종(16×16 프레임 2개).

몸통은 외곽선 없이 칠한 뒤 color_outline()으로 재질에 맞는 색 외곽선을 두른다(누리의 화풍).
대칭인 몸은 왼쪽 절반(8칸)만 그리고 sym()으로 좌우를 맞춘다. 빛은 왼쪽 위에서 온다.
지역 1~3 몬스터(슬라임 돔, 박쥐, 고리 뱀, 네모 부엉이 등)와 실루엣이 겹치지 않게:
나방은 넓은 두 겹 날개, 잉크 슬라임은 쓰러진 잉크병을 머리에 인 납작한 웅덩이, 깃펜 정령은 비스듬한 깃털,
두루마리 뱀은 뒤에 말린 두루마리 통과 S자로 풀린 종이 몸, 암호 부엉이는 책 위에 앉은 둥근 몸과 바퀴 눈.
"""
import math

from gridlib import overlay, shift
from librarypal import color_outline, paint, shade_right, sym

# ── 글자 나방: 양피지 날개 두 겹, 앞날개에 잉크로 찍힌 글자(A와 Z), 털 많은 갈색 몸, 깃털 더듬이 ─────────
# 프레임 B는 날개를 위로 접어 올린다(글자도 함께 올라간다)
MOTH_KEY = {"b": "a1", "a": "a3", "A": "a4", "Q": "a5", "x": "k2", "w": "w3", "W": "w4", "v": "w2", "H": "w5",
            "e": "eye", "t": "w2", "i": "i3", "I": "i4"}

_MOTH_A = paint(sym("""
    ........
    ...t....
    ....t...
    .....t.W
    .bbbb.WH
    bAAAAbeH
    bAQAAAbW
    bAAAAAbv
    bAAAAAbW
    biAAAAbv
    .bbAAbbW
    ..bAAAbv
    .bAAAabW
    ..bbbb.v
    ........
    ........
"""), MOTH_KEY, 16, 16)

_MOTH_B = paint(sym("""
    ........
    .bb.....
    bAAbb...
    bAQAAbt.
    bAAAAAbW
    bAAAAAWH
    .bAAAbeH
    .biAAAbW
    ..bAAAbv
    ...bbbbW
    ...bAAbv
    ...bAAbW
    ....bb.v
    ........
    ........
    ........
"""), MOTH_KEY, 16, 16)

_GLYPH_A = paint("""
    .x.
    x.x
    xxx
    x.x
""", MOTH_KEY, 3, 4)
_GLYPH_Z = paint("""
    xxx
    ..x
    .x.
    xxx
""", MOTH_KEY, 3, 4)


def _letter_moth(up: bool):
    g = _MOTH_B if up else _MOTH_A
    g = shade_right(g, 9)
    if up:
        g = overlay(overlay(g, _GLYPH_A, 2, 4), _GLYPH_Z, 11, 4)
    else:
        g = overlay(overlay(g, _GLYPH_A, 2, 6), _GLYPH_Z, 11, 6)
    return color_outline(g)


# ── 잉크 슬라임: 머리에 쓰러진 잉크병(유리·코르크·양피지 상표)을 이고, 병 주둥이에서 흘러나온 검푸른 웅덩이 몸 ──
# 프레임 B는 몸이 퍼지며 낮아지고 옆으로 잉크 방울이 떨어진다
INK_KEY = {"0": "k0", "1": "k1", "2": "k2", "3": "k3", "4": "k4", "5": "k5", "e": "white", "E": "eye",
           "g": "s5", "G": "s6", "h": "s3", "y": "g3", "l": "a4", "L": "a3"}

# 잉크병: 옆으로 누운 유리병(왼쪽이 바닥, 오른쪽이 금테 두른 주둥이), 속에 잉크가 비치고 양피지 상표가 붙었다
_INK_A = paint("""
    ................
    ................
    .hhhhhhh........
    hGGGGGGGhy......
    hG2llLl2hyGG....
    hg222222hy222...
    .hhhhhhh.y.234..
    ...........3443.
    ....234444443432
    ...234eE44eE432.
    ..2344EE44EE4432
    ..23444444444432
    .123333333333321
    .11222222222211.
    ..111111111111..
    ................
""", INK_KEY, 16, 16)

_INK_B = paint("""
    ................
    ................
    ................
    ..hhhhhhh.......
    .hGGGGGGGhy.....
    .hG2llLl2hyGG...
    .hg222222hy222..
    ..hhhhhhh.y.23..
    ............34..
    ...23444444432..
    ..2344eE44eE432.
    .23444EE44EE4432
    1234444444444432
    1233333333333321
    .11222222222211.
    ..111111111111.2
""", INK_KEY, 16, 16)


def _ink_slime(spread: bool):
    return color_outline(shade_right(_INK_B if spread else _INK_A, 12))


# ── 깃펜 정령: 비스듬히 선 깃털 펜(아래 금 펜촉, 위 청록 서리 낀 깃 끝), 깃 가운데 작은 얼굴과 두 팔 ──────
# 프레임 B는 한 칸 떠오르고 펜촉에서 잉크 방울이 떨어진다
QUILL_KEY = {"A": "a5", "a": "a4", "b": "a3", "B": "a2", "s": "w4", "S": "w2", "i": "i3", "I": "i4", "J": "i5",
             "g": "g3", "G": "g4", "e": "eye", "p": "blush", "k": "k2", "K": "k3"}

_QUILL = paint("""
    ............J...
    ..........IiI...
    .........IaAi...
    ........aAAbi...
    .......aAAAbI...
    ......aAeAebB...
    .....aAAApbB....
    ....baAAAbbB....
    ...a.baAbbB.a...
    ......bAbB......
    ......BsB.......
    .....Ss.........
    ....Gs..........
    ....g...........
    ................
    ................
""", QUILL_KEY, 16, 16)


def _quill_sprite(float_up: bool):
    g = color_outline(_QUILL)
    if float_up:
        g = shift(g, 0, -1)
        drop = color_outline(paint("""
            ...
            .K.
            .k.
            ...
        """, QUILL_KEY, 3, 4))
        g = overlay(g, drop, 3, 12)
    else:
        spark = paint("""
            .J.
            JIJ
            .J.
        """, QUILL_KEY, 3, 3)
        g = overlay(g, spark, 12, 9)
    return g


# ── 두루마리 뱀: 왼쪽에 끝이 보이게 말린 두루마리 통(소용돌이, 가운데 나무 축), 거기서 풀린 종이 띠가
# 바닥을 따라 물결치며 오른쪽으로 기어가고, 끝을 접어 만든 머리(눈, 빨간 끈 혀)를 살짝 든다.
# 프레임 B는 물결이 반 박자 옮겨 가고 머리가 한 칸 내려온다 ──────────────────────────────
SCROLL_KEY = {"A": "a5", "a": "a4", "b": "a3", "B": "a2", "c": "a1", "t": "a0", "W": "w4", "w": "w2",
              "e": "eye", "r": "r3", "R": "r2"}

_ROLL = paint("""
    .WW.
    WwwW
    bAbB
    bAbB
    bAcB
    bAbB
    bAcB
    bAbB
    WwwW
    .WW.
""", SCROLL_KEY, 4, 10)

_HEAD = paint("""
    ..aAAA..
    .aAAeAAb
    aAAAAAbr
    .bBBBb.r
""", SCROLL_KEY, 8, 4)


def _scroll_snake(phase: int):
    g = [["."] * 16 for _ in range(16)]
    # 종이 띠: 두께 3(위 밝음, 가운데 글줄, 아래 그늘), 두루마리 통 오른쪽(x 4)에서 목(x 11)까지
    for x in range(4, 12):
        yc = round(11 + 1.6 * math.sin((x - 4) * 1.1 + phase * math.pi))
        g[yc - 1][x] = "A"
        g[yc][x] = "c" if x % 2 else "a"
        g[yc + 1][x] = "B"
    rows = paint("\n".join("".join(r) for r in g), SCROLL_KEY, 16, 16)
    # 목: 띠 끝에서 머리 쪽으로 올라간다
    head_y = 4 + phase
    neck = paint("""
        aB
        aB
        aB
        aB
        aB
    """, SCROLL_KEY, 2, 5)
    rows = overlay(rows, neck, 11, head_y + 3)
    rows = overlay(rows, _HEAD, 8, head_y)
    rows = overlay(rows, _ROLL, 0, 5)
    return color_outline(rows)


# ── 암호 부엉이: 빨간 책 위에 앉은 둥근 남보라 부엉이. 양피지 얼굴판에 금 바퀴 눈(바늘 같은 표시가 돈다),
# 깃털 귀. 프레임 B는 바퀴 표시가 돌아가고 날개를 살짝 편다 ─────────────────────────────
OWL_KEY = {"0": "o0", "1": "o1", "2": "o2", "3": "o3", "4": "o4", "5": "o5", "a": "a3", "A": "a4", "B": "a2",
           "g": "g3", "G": "g4", "h": "g2", "e": "eye", "i": "i4", "y": "g3", "r": "r3", "R": "r2", "x": "r1",
           "p": "a5", "q": "a3"}

_OWL_BODY = paint(sym("""
    ........
    ..3.....
    ..43....
    ..4433..
    .344444.
    .3AAAAAA
    3AAhhhAA
    3AhggghA
    3AhgeghB
    3AhggghA
    .3AhhhAy
    .3444AAy
    .34435A3
    .344354.
    ..33433.
    ..rrrrrr
"""), OWL_KEY, 16, 16)

_OWL_WINGS_OUT = paint(sym("""
    ........
    ..3.....
    ..43....
    ..4433..
    .344444.
    .3AAAAAA
    3AAhhhAA
    3AhggghA
    3AhgeghB
    3AhggghA
    13AhhhAy
    2.3444AA
    ..34435A
    ..344354
    ...33433
    ..rrrrrr
"""), OWL_KEY, 16, 16)

# 바퀴 눈 위의 표시(멈춘 시계 바늘처럼 도는 글자 칸): A는 12시·6시, B는 3시·9시 쪽
_TICKS_A = [(4, 7), (4, 9), (11, 7), (11, 9)]
_TICKS_B = [(3, 7), (5, 9), (10, 7), (12, 9)]
_TICK = paint("p", OWL_KEY, 1, 1)


def _cipher_owl(turn: bool):
    g = _OWL_WINGS_OUT if turn else _OWL_BODY
    g = shade_right(g, 9)
    # 책(빨간 표지, 양피지 속지) 아래쪽
    book = paint("""
        .RRRRRRRRRRRRRR.
    """, OWL_KEY, 16, 1)
    g = overlay(g, book, 0, 15)
    for x, y in _TICKS_B if turn else _TICKS_A:
        g = overlay(g, _TICK, x, y)
    return color_outline(g)


LIBRARY_MONSTERS = {
    "monster_letter_moth": [_letter_moth(False), _letter_moth(True)],
    "monster_ink_slime": [_ink_slime(False), _ink_slime(True)],
    "monster_quill_sprite": [_quill_sprite(False), _quill_sprite(True)],
    "monster_scroll_snake": [_scroll_snake(0), _scroll_snake(1)],
    "monster_cipher_owl": [_cipher_owl(False), _cipher_owl(True)],
}
