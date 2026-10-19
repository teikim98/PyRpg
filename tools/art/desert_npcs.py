"""지역 7 NPC 걷기 시트(16×16 × 8프레임: 아래×2, 왼쪽×2, 오른쪽×2, 위×2).

- npc_caravan_guide: 대상(隊商) 길잡이. 흰 터번에 남청 띠, 햇볕에 그을린 얼굴, 모래빛 긴 옷에 남청 허리띠,
  허리에 갈색 가죽 물주머니, 한 손에 머리 위까지 올라오는 긴 지팡이(끝이 굽음).
- npc_hourglass_keeper: 모래시계지기. 밤하늘 남색 두건 망토(등에 작은 별 무늬, 앞섶에 금 걸쇠), 두건 그늘 속 얼굴,
  두 손으로 작은 금테 모래시계를 가슴 앞에 받쳐 들었다.

characters.py의 character()로 다리를 끼워 8프레임을 만들고, 지팡이·물주머니·모래시계는 다리를 끼운 뒤 방향마다 같은
자리에 겹친다. 외곽선 K는 닿은 재질의 색 외곽선으로 바꾼다(lake_npcs.py와 같은 방식).
"""
from characters import character
from gridlib import mirror, overlay
from desertpal import CH, color_outline, paint, sym

# ── 대상 길잡이 ────────────────────────────────────────────────────────────
GUIDE_KEY = {"T": "t4", "t": "t3", "U": "t2", "Q": "q3", "q": "q2", "s": "c3", "S": "c2", "E": "eye", "b": "blush",
             "R": "d5", "r": "d4", "n": "d3", "h": "c4"}

GUIDE_DOWN = paint(sym("""
    ........
    .....KKK
    ....KTTT
    ...KTTtT
    ...KQQQQ
    ...KTTTt
    ...KSsss
    ...KsEss
    ...Kbsss
    ..KRRRRr
    .KRRRRRr
    .KRqqqqq
    .KhRrRRr
    ..KnnnRr
"""), GUIDE_KEY, 16, 14)

GUIDE_RIGHT = paint("""
    ................
    .....KKKK.......
    ....KTTTTK......
    ...KTTtTTTK.....
    ...KQQQQQQK.....
    ..KUKTTTTtK.....
    ..KUKSssssK.....
    ..KUKsssEsK.....
    ...K.KsbssK.....
    ....KRRRRrK.....
    ...KRRRRRrK.....
    ...KRqqqhsK.....
    ...KRrRRRrK.....
    ....KnnRrK......
""", GUIDE_KEY, 16, 14)

GUIDE_UP = paint(sym("""
    ........
    .....KKK
    ....KTTT
    ...KTTtT
    ...KQQQQ
    ...KTTTT
    ...KTtTT
    ...KUtTT
    ...KUUUU
    ..KRRRRR
    .KRRRRRR
    .KRqqqqq
    .KhRrRRR
    ..KnnnRR
"""), GUIDE_KEY, 16, 14)

STAFF_KEY = {"H": "w4", "h": "w3", "d": "w2", "s": "c3", "S": "c2"}
# 지팡이: 끝이 앞으로 굽은 긴 막대와 쥔 손. 오른쪽 그림 기준, 다른 방향은 자리를 옮긴다
_STAFF = paint("""
    Hh.
    .Hh
    .Hh
    .Hh
    .Hh
    .Hh
    .Hh
    .Hh
    .Hh
    .Hh
    .sS
    .Hh
    .Hh
    .Hh
    .Hd
    .dd
""", STAFF_KEY, 3, 16)
BAG_KEY = {"B": "w4", "b": "w3", "d": "w1", "c": "q2"}
_BAG = paint("""
    .c.
    BBb
    Bbd
    .d.
""", BAG_KEY, 3, 4)


def _guide(frames):
    """프레임 순서: 아래 0,1 · 왼쪽 0,1 · 오른쪽 0,1 · 위 0,1. 지팡이는 아래·오른쪽은 그림 오른쪽, 왼쪽·위는 그림 왼쪽,
    물주머니는 아래는 왼쪽 허리, 옆은 뒤쪽 허리."""
    out = []
    for i, f in enumerate(frames):
        if i < 2:
            g = overlay(overlay(f, _STAFF, 12, 0), _BAG, 2, 10)
        elif i < 4:
            g = overlay(overlay(f, mirror(_STAFF), 1, 0), mirror(_BAG), 10, 10)
        elif i < 6:
            g = overlay(overlay(f, _STAFF, 12, 0), _BAG, 3, 10)
        else:
            g = overlay(f, mirror(_STAFF), 1, 0)
        out.append(color_outline(g))
    return out


# ── 모래시계지기 ────────────────────────────────────────────────────────────
KEEPER_KEY = {"V": "v4", "v": "v3", "n": "v2", "m": "v1", "s": "c3", "S": "c2", "E": "eye", "G": "g4", "*": "v6"}

KEEPER_DOWN = paint(sym("""
    ........
    ......KK
    .....KVV
    ....KVVV
    ...KVVvv
    ...KVmSS
    ...KVSss
    ..KVvsEs
    ..KVvSss
    ..KVvvvG
    .KVVvvvv
    .KVvvvvv
    .KVvvvnn
    .KnnnnnK
"""), KEEPER_KEY, 16, 14)

KEEPER_RIGHT = paint("""
    ................
    .....KKK........
    ....KVVVK.......
    ...KVVVVVK......
    ...KVVVvmmK.....
    ..KVVvvmSsK.....
    ..KVvvvSssK.....
    ..KVvvvsEsK.....
    ..KVvvvSssK.....
    ..KVvvvvGK......
    .KVVvvvvvK......
    .KVvvvvvvK......
    .KVvvvvnnK......
    .KnnnnnnK.......
""", KEEPER_KEY, 16, 14)

KEEPER_UP = paint(sym("""
    ........
    ......KK
    .....KVV
    ....KVVV
    ...KVVVv
    ...KVVvv
    ...KVvvv
    ..KVvvvv
    ..KVv*vv
    ..KVvvvv
    .KVVvvv*
    .KVvvvvv
    .KVv*vnn
    .KnnnnnK
"""), KEEPER_KEY, 16, 14)

GLASS_KEY = {"G": "g4", "g": "g2", "c": "i3", "s": "d5", "h": "c3"}
# 손에 든 작은 모래시계(금 위·아래 판, 청록 유리, 위에서 아래로 흐르는 모래)와 받친 두 손
_GLASS = paint("""
    .GGGG.
    h.cs.h
    h.sc.h
    .gggg.
""", GLASS_KEY, 6, 4)
_GLASS_SIDE = paint("""
    GGG
    cs.
    sc.
    ggh
""", GLASS_KEY, 3, 4)


def _keeper(frames):
    """아래는 가슴 앞 가운데, 옆은 앞쪽으로 내민 손, 위(뒷모습)는 모래시계가 가려 보이지 않는다."""
    out = []
    for i, f in enumerate(frames):
        if i < 2:
            g = overlay(f, _GLASS, 5, 9)
        elif i < 4:
            g = overlay(f, mirror(_GLASS_SIDE), 3, 8)
        elif i < 6:
            g = overlay(f, _GLASS_SIDE, 10, 8)
        else:
            g = f
        out.append(color_outline(g))
    return out


DESERT_CHARACTERS = {
    "npc_caravan_guide": _guide(character(GUIDE_DOWN, GUIDE_RIGHT, GUIDE_UP, CH["d3"], CH["w2"])),
    "npc_hourglass_keeper": _keeper(character(KEEPER_DOWN, KEEPER_RIGHT, KEEPER_UP, CH["v2"], CH["k2"])),
}
