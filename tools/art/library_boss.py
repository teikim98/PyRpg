"""지역 4 보스(32×32 프레임 2개): 사서 골렘.

몸통은 책이 꽂힌 책장(나무 틀, 두 칸), 머리는 금 모서리 장식을 댄 두꺼운 포도주색 책 한 권이고 표지에 청록 눈 틈이
뚫려 있다. 어깨와 팔은 층층이 쌓인 책, 다리는 짧은 나무 기둥. 가슴 한가운데에는 지역 1~3 보스와 같은
청록 문자판의 시계 룬이 책 사이에 박혀 있고, 오른손(그림 오른쪽)에 키만 한 깃펜을 쥐었다.
몸은 왼쪽 절반(16칸)만 그리고 좌우를 맞춘 뒤 비대칭 장식(시계 바늘, 깃펜, 쥔 주먹)을 얹는다.
프레임 A는 노려보고, 프레임 B는 눈과 문자판이 밝아지고 깃펜을 치켜든다.
"""
from gridlib import overlay
from librarypal import color_outline, paint, shade_right, sym

SIZE = 32

_HALF = """
    ................
    ................
    ..........hGGGGG
    .........hGRRRRR
    .........GRrRRRR
    .........RRrrrrr
    .........RrIiirr
    .........Rrrrrrr
    .........RRrrrrr
    .........GRrrrrr
    .........hGxxxxx
    ...uUUUU...zqqqq
    ..uUUUUUUOOOOOOO
    ..AaAaAaAqqqqqqq
    ..xRRRRRpRrUuZEe
    ..RRRRRRpRrUuAEe
    ..xrrrrrpGgUuAEe
    ..EEEEEEpRrUuAEe
    ..aAaAaAaoooooo.
    ..eeeeeepqqqqq..
    ..UUUUUUpEeZZ...
    ..AaAaAapEeRr...
    ..uuuuuupGgRr...
    .RRRRRRRpEeRr...
    .rrrrrrroooooooo
    .xxxxxxxzzzzzzzz
    .........pooq...
    .........pooq...
    .........pooq...
    ........Opooqz..
    .......OOoooqqz.
    ................
"""

LEGEND = {
    "R": "r3", "r": "r2", "x": "r1",
    "G": "g4", "g": "g3", "h": "g2",
    "I": "i4", "i": "i3",
    "O": "w5", "o": "w4", "p": "w3", "q": "w2", "z": "w1", "Z": "w0",
    "E": "e3", "e": "e2", "U": "u3", "u": "u2", "A": "a4", "a": "a3",
}
AWAKE = {**LEGEND, "I": "i5", "i": "i4"}

_DIAL = """
    ..hGGh..
    .hDDDDh.
    hDdDDDDh
    GDDLDDDG
    GDDLLDDG
    hDDDDDDh
    .hDDDDh.
    ..hGGh..
"""
DIAL_KEY = {"h": "g2", "G": "g4", "D": "i2", "d": "i4", "L": "i0"}
DIAL_AWAKE = {**DIAL_KEY, "D": "i3", "d": "i5"}

_QUILL = """
    ...J...
    ..IAI..
    .IAAAi.
    .AAAAb.
    .AAAbb.
    AAAbbB.
    AAAbbB.
    AAbbB..
    AAbbB..
    .AbbB..
    .AbB...
    .AbB...
    ..bB...
    ..sB...
    ..s....
    ..s....
    ..s....
    ..s....
    ..S....
    ..S....
    ..S....
    ..S....
    ..G....
    ..g....
"""
QUILL_KEY = {"A": "a5", "b": "a3", "B": "a2", "I": "i4", "i": "i3", "J": "i5", "s": "w4", "S": "w3",
             "G": "g4", "g": "g3"}


def _golem(awake: bool):
    body = paint(sym(_HALF), AWAKE if awake else LEGEND, SIZE, SIZE)
    body = overlay(body, paint(_DIAL, DIAL_AWAKE if awake else DIAL_KEY, 8, 8), 12, 15)
    body = shade_right(body, 20)
    g = color_outline(body)
    # 오른손의 큰 깃펜(그림 오른쪽). 프레임 B는 세 칸 들어 올린다
    lift = 3 if awake else 0
    quill = color_outline(paint(_QUILL, QUILL_KEY, 7, 24))
    g = overlay(g, quill, 25, 4 - lift)
    # 깃펜을 쥔 주먹(책 한 권처럼 네모난 손)
    fist = color_outline(paint("""
        .RRR.
        RrrrR
        xrrrx
    """, LEGEND, 5, 3))
    g = overlay(g, fist, 25, 21 - lift)
    return g


LIBRARY_BOSSES = {"boss_librarian_golem": [_golem(False), _golem(True)]}
