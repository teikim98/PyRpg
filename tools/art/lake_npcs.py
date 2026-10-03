"""지역 6 NPC 걷기 시트(16×16 × 8프레임: 아래×2, 왼쪽×2, 오른쪽×2, 위×2).

- npc_lake_keeper: 늙은 호수지기. 챙 넓은 밀짚모자(삿갓 모양), 가슴까지 내려오는 흰 수염, 바랜 남청 저고리,
  한 손에 머리 위까지 올라오는 긴 삿대를 세워 쥐었다.

characters.py의 character()로 다리를 끼워 8프레임을 만들고, 삿대는 다리를 끼운 뒤 방향마다 같은 자리에 겹친다.
외곽선 K는 닿은 재질의 색 외곽선으로 바꾼다.
"""
from characters import character
from gridlib import mirror, overlay
from lakepal import CH, color_outline, paint, sym

KEY = {"Y": "y4", "y": "y3", "Z": "y1", "z": "y2", "s": "c3", "S": "c2", "E": "eye", "b": "blush",
       "W": "a4", "w": "a2", "Q": "q3", "q": "q2", "n": "q1", "G": "a3"}

DOWN = paint(sym("""
    ........
    ......KK
    .....KYy
    ....KYyy
    ..KKYyyy
    .KYYzyyy
    KZZZZZZZ
    .KKSssss
    ..KsEsss
    ..KsbWWW
    ..KWWWwW
    .KQWWWWw
    KqQQWWQQ
    .KnqQQQQ
"""), KEY, 16, 14)

RIGHT = paint("""
    ................
    ......KK........
    .....KYyK.......
    ....KYyyyK......
    ...KYYyyyyKK....
    ..KYzyyyyyyyK...
    .KZZZZZZZZZZZK..
    ....KGSsssK.....
    ....KGsssEsK....
    ....KGssbWWK....
    ....KQWWWWWWK...
    ...KqQQWWwK.....
    ...KqQQQQQK.....
    ....KnqQQK......
""", KEY, 16, 14)

UP = paint(sym("""
    ........
    ......KK
    .....KYy
    ....KYyy
    ..KKYyyy
    .KYYzyyy
    KZZZZZZZ
    .KKwGGGG
    ..KQwwww
    ..KQQQQQ
    ..KqQQQQ
    .KqQQQQQ
    KqQQQQQQ
    .KnqQQQQ
"""), KEY, 16, 14)

POLE_KEY = {"H": "h4", "h": "h3", "d": "h2", "s": "c3", "S": "c2"}
# 삿대: 세로 막대(빛 받는 쪽 밝게)와 쥔 손. 오른쪽 그림 기준, 다른 방향은 자리를 옮긴다
_POLE = paint("""
    Hh
    Hh
    Hh
    Hh
    Hh
    Hh
    Hh
    Hh
    Hh
    Hh
    sS
    Hh
    Hh
    Hh
    Hd
    dd
""", POLE_KEY, 2, 16)


def _with_pole(frames):
    """프레임 순서: 아래 0,1 · 왼쪽 0,1 · 오른쪽 0,1 · 위 0,1. 아래는 그림 오른쪽, 옆은 앞쪽, 위는 그림 왼쪽에 삿대."""
    out = []
    for i, f in enumerate(frames):
        if i < 2:
            g = overlay(f, _POLE, 13, 0)
        elif i < 4:
            g = overlay(f, mirror(_POLE), 1, 0)
        elif i < 6:
            g = overlay(f, _POLE, 13, 0)
        else:
            g = overlay(f, mirror(_POLE), 1, 0)
        out.append(color_outline(g))
    return out


LAKE_CHARACTERS = {
    "npc_lake_keeper": _with_pole(character(DOWN, RIGHT, UP, CH["q1"], CH["h2"])),
}
