"""지역 5 NPC 걷기 시트(16×16 × 8프레임: 아래×2, 왼쪽×2, 오른쪽×2, 위×2).

- npc_guild_master: 상인 길드장. 금테를 두른 둥근 모자, 흰 구레나룻, 둥근 체형에 짙은 청록 벨벳 조끼(금단추),
  옆구리에 두꺼운 빨간 장부를 끼고 있다.

characters.py의 character()로 다리를 끼워 8프레임을 만들고, 외곽선 K는 닿은 재질의 색 외곽선으로 바꾼다.
"""
from characters import character
from gridlib import overlay
from portpal import CH, color_outline, paint, sym

KEY = {"k": "k2", "L": "k3", "G": "g4", "g": "g3", "s": "s3", "S": "s2", "E": "eye", "b": "blush",
       "h": "l4", "H": "l2", "V": "v4", "v": "v3", "n": "v2", "W": "a4", "R": "r3", "r": "r2", "A": "a4"}

DOWN = paint(sym("""
    ........
    ....KKKK
    ...KkLkk
    ...KGGGG
    .KKkkkkk
    .KGGGGGG
    ..Khssss
    ..KhsEss
    ..Khsbss
    ..KhVVWW
    .KnvVVVg
    KnvvVVVV
    KnvvVVVg
    .KnvvVVV
"""), KEY, 16, 14)

RIGHT = paint("""
    ................
    .....KKKKK......
    ....KkLkkkK.....
    ....KGGGGGK.....
    ..KKkkkkkkkkK...
    ..KGGGGGGGGGGK..
    ....KhhssssK....
    ....KhhssEsK....
    ....Khhsbsss....
    ....KhVVWWsK....
    ...KnvVRRRRK....
    ..KnvVRAAARK....
    ..KnvVRRRRRK....
    ...KnvVVVVgK....
""", KEY, 16, 14)

UP = paint(sym("""
    ........
    ....KKKK
    ...KkLkk
    ...KGGGG
    .KKkkkkk
    .KGGGGGG
    ..KHhhhh
    ..KHHhhH
    ..KnHHHH
    ..KnVVVV
    .KnvVVVV
    KnvvVVVV
    KnvvVVVV
    .KnvvVVV
"""), KEY, 16, 14)

# 정면에서는 그림 왼쪽 옆구리에 두꺼운 장부를 끼고 있다
_LEDGER = paint("""
    RRR
    rAr
    RRR
    rAr
""", KEY, 3, 4)
DOWN = overlay(DOWN, _LEDGER, 0, 9)

PORT_CHARACTERS = {
    "npc_guild_master": [color_outline(f) for f in character(DOWN, RIGHT, UP, CH["v1"], CH["w1"])],
}
