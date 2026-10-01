"""캐릭터 시트(16×16 프레임 8개: 아래×2, 왼쪽×2, 오른쪽×2, 위×2).

캐릭터마다 아래·오른쪽·위 방향의 몸통(0~13행)을 그리고, 14~15행 다리는 걷기 프레임마다 바꿔 끼운다.
왼쪽은 오른쪽을 좌우 반전한다. 아래·위는 두 프레임이 왼발·오른발을 번갈아 살짝 드는 걸음이고,
옆모습은 [모은 다리, 벌린 다리]다.
"""
from gridlib import grid, mirror
from nuripal import CH


def legs_down(p, f, frame):
    if frame == 0:
        return [f"....K{f}{f}KK{p}{p}K....", f".....KK.K{f}{f}K...."]
    return [f"....K{p}{p}KK{f}{f}K....", f"....K{f}{f}K.KK....."]


def legs_side(p, f, frame):
    if frame == 0:
        return [f"......K{p}{p}K......", f"......K{f}{f}{f}K....."]
    return [f".....K{p}KK{p}K.....", f"....K{f}{f}K.K{f}{f}K..."]


def character(down, right, up, pants, boots, legs_fn_down=legs_down, legs_fn_side=legs_side):
    """몸통 3방향 → 8프레임 그리드 리스트(아래 0,1 · 왼쪽 0,1 · 오른쪽 0,1 · 위 0,1)."""
    frames = []
    for body, kind in ((down, "down"), (mirror(right), "left"), (right, "right"), (up, "up")):
        for fr in (0, 1):
            if kind in ("down", "up"):
                legs = legs_fn_down(pants, boots, fr)
                if kind == "up":
                    legs = mirror(legs)
            else:
                legs = legs_fn_side(pants, boots, fr)
                if kind == "left":
                    legs = mirror(legs)
            f = body + legs
            if len(f) != 16:
                raise ValueError(f"frame height {len(f)}")
            frames.append(f)
    return frames


# ── 주인공: 기억을 잃은 젊은 주문사. 남색 후드 망토, 청록 룬 걸쇠 ─────────────────
PLAYER_DOWN = grid("""
    ................
    .....KKKKKK.....
    ....KVVVVVVK....
    ...KVVVVVVVVK...
    ..KVVbbbbbbVvK..
    ..KVbsbbbbsbvK..
    ..KVbKssssKbvK..
    ..KVsKssssKsvK..
    ..KVvissssivvK..
    ...KvVSssSVvK...
    ..KvVVVTTVVVvK..
    .KvVVVVccVVVVvK.
    .KsKVVVVVVVVKsK.
    ..KKvvvvvvvvKK..
""", 16, 14)

PLAYER_RIGHT = grid("""
    ................
    .....KKKKK......
    ....KVVVVVKK....
    ...KVVVVVVVVK...
    ..KVVVVvbbbbbK..
    ..KVVVvbbssbsK..
    ..KVVVvbssKssK..
    ..KVVVVvssKssK..
    ..KvVVVvsssisK..
    ...KvVVVvSssK...
    ...KvVVVVTVK....
    ...KvVVVVVVK....
    ...KvVVVVsKK....
    ....KvvvvvK.....
""", 16, 14)

PLAYER_UP = grid("""
    ................
    .....KKKKKK.....
    ....KVVVVVVK....
    ...KVVVVVVVVK...
    ..KVVVVVVVVVvK..
    ..KVVVVVVVVVvK..
    ..KVVVVVVVVVvK..
    ..KVVVvVVvVVvK..
    ..KvVVVvvVVVvK..
    ...KvVVVVVVvK...
    ..KvVVVVVVVVvK..
    .KvVVVVVVVVVVvK.
    .KsKVVVVVVVVKsK.
    ..KKvvvvvvvvKK..
""", 16, 14)

# ── 누리(모에 SD): 큰 머리, 바보털, 청록 리본의 주황 포니테일, 황동 고글, 초록 눈과 홍조,
#    올리브 망토, 어깨의 지도통. 초상화와 같은 확장 팔레트(nuripal)로 색을 비튼 음영과 색 외곽선을 쓴다.
#    아래 그리드는 지역 범례(NURI_KEY)로 쓰고, 외곽선 K는 닿은 재질에 맞는 색으로 바꾼다.
NURI_KEY = {
    "1": "h1", "2": "h2", "3": "h3", "4": "h4", "5": "h5",
    "s": "s4", "S": "s3", "i": "bl0", "e": "lash", "g": "e2", "w": "sc",
    "U": "b3", "u": "b1", "Y": "b4", "c": "t3", "t": "t1", "T": "t2",
    "o": "c1", "q": "c2", "O": "c3", "Q": "c4", "W": "w3", "B": "l2", "b": "l1", "n": "l3",
}
_HAIR = {CH[k] for k in ("h1", "h2", "h3", "h4", "h5")}
_SKIN = {CH[k] for k in ("s4", "s3", "bl0")}
_CAPE = {CH[k] for k in ("c1", "c2", "c3", "c4")}


def nuri_grid(text):
    """지역 범례(NURI_KEY)로 쓴 16×14 그리드 → 팔레트 문자 그리드(크기·문자 검사 포함)."""
    table = str.maketrans({k: CH[v] for k, v in NURI_KEY.items()})
    return grid(text.translate(table), 16, 14)


def color_outlines(frame):
    """외곽선 K를 닿은 재질에 맞는 색 외곽선(머리카락·피부·망토·그 밖)으로 바꾼다."""
    h, w = len(frame), len(frame[0])
    out = [list(r) for r in frame]
    for y in range(h):
        for x in range(w):
            if frame[y][x] != "K":
                continue
            nb = {frame[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                  if 0 <= x + dx < w and 0 <= y + dy < h}
            if nb & _HAIR:
                out[y][x] = CH["ol_hair"]
            elif nb & _SKIN:
                out[y][x] = CH["ol_skin"]
            elif nb & _CAPE:
                out[y][x] = CH["ol_cape"]
            else:
                out[y][x] = CH["ol"]
    return ["".join(r) for r in out]


NURI_DOWN = nuri_grid("""
    .....KK.........
    ....K4K.........
    ....KK4KKKKK....
    ...K44443332KKK.
    ..KUccUuuUccUKcK
    ..K4UU3333UU2KTK
    ..K4455343332K2K
    ..K4243ss3312K1K
    ..K3eessssee2K1K
    ..K3wgsssswg2K.K
    ..K3isssssSi2K..
    .KUKqQOYUOqoKK..
    .KsKQWWbOOqoKSK.
    ..KKqOOObOqoKK..
""")

NURI_RIGHT = nuri_grid("""
    ......KK........
    .....K4K........
    ....KK4KKKKK....
    ..KKK4444333K...
    .KcTK44433UccK..
    K4t2K44333uUUK..
    K423K44533332K..
    K42K433331s2sK..
    K41K43332seesK..
    .K1K33321swgsK..
    ..KK33221ssisK..
    ...KUqQOOqSK....
    ..KBnQOOOWqK....
    ..KbnqOOqsKK....
""")

NURI_UP = nuri_grid("""
    .........KK.....
    .........K4K....
    ....KKKKK4KK....
    .KKK44443332K...
    .KcKbUbbbbbbUK..
    KTK4443333322K..
    K4K4553344332K..
    K42K433333322KK.
    K41K423333221KUK
    .K1K333332221KnK
    ..KK33332222KKnK
    .KqQKK3221KKqKK.
    .KsKnBBUYBBBbKSK
    ..KKqOQOOOOqKK..
""")

# ── 상인(얼어붙은 상인): 빨간 모자, 콧수염, 보라 조끼, 앞치마 ───────────────────
MERCHANT_DOWN = grid("""
    ................
    .....KKKKKK.....
    ....KxxxxxxK....
    ...KxxxxxxxXK...
    ..KXXXXXXXXXXK..
    ..KSssssssssSK..
    ..KssKssssKssK..
    ..KssKssssKssK..
    ..KisbbbbbbsiK..
    ...KSsbssbsSK...
    ..KpPPWWWWPPpK..
    .KpPPPWWWWPPPpK.
    .KsKpWWWWWWpKsK.
    ..KKpWWWWWWpKK..
""", 16, 14)

MERCHANT_RIGHT = grid("""
    ................
    .....KKKKK......
    ....KxxxxxXK....
    ...KxxxxxxxXK...
    ..KXXXXXXXXXXXK.
    ...KbSssssssK...
    ...KbSssssKsK...
    ...KbSssssKssK..
    ...KbSsssssssK..
    ...KbSsssbbbK...
    ....KKSsssbK....
    ...KpPPPPWWK....
    ...KpPPPsWWWK...
    ....KpppWWWK....
""", 16, 14)

MERCHANT_UP = grid("""
    ................
    .....KKKKKK.....
    ....KxxxxxxK....
    ...KxxxxxxxXK...
    ..KXXXXXXXXXXK..
    ..KbbbbbbbbbbK..
    ..KbBBBBBBBBbK..
    ..KbBBBBBBBBbK..
    ..KSbBBBBBBbSK..
    ...KSbbbbbbSK...
    ..KpPPPPPPPPpK..
    .KpPPPWWWWPPPpK.
    .KsKpPPPPPPpKsK.
    ..KKpppppppppK..
""", 16, 14)

# ── 마을 주민(상점 주인): 갈색 머리 쪽머리, 초록 원피스, 흰 앞치마 ───────────────
VILLAGER_DOWN = grid("""
    ......KKKK......
    .....KBBBBK.....
    ....KKBBBBKK....
    ...KBBBBBBBBK...
    ..KBBnnBBnnBbK..
    ..KBnsssssnBbK..
    ..KBsKssssKsbK..
    ..KBsKssssKsbK..
    ..KBbissssibbK..
    ...KbSssssSbK...
    ..KdeeeWWeeedK..
    .KdeeeWWWWeeedK.
    .KsKeWWWWWWeKsK.
    ..KKdWWWWWWdKK..
""", 16, 14)

VILLAGER_RIGHT = grid("""
    ................
    ..KKK.KKKKK.....
    .KBBBKBBBBBKK...
    .KBnBKBBBBBBBK..
    ..KKKBBBBBnnnK..
    ...KBBBBnsssK...
    ...KBBBbssKsK...
    ...KBBBbssKsK...
    ...KbBBbsssisK..
    ....KbbbSssK....
    ...KdeeeeWWK....
    ...KdeeeeWWWK...
    ...KdeeesWWWK...
    ....KdddWWWK....
""", 16, 14)

VILLAGER_UP = grid("""
    ......KKKK......
    .....KBnBBK.....
    ....KKBBBbKK....
    ...KBBBBBBBBK...
    ..KBBBBBBBBBbK..
    ..KBBBBBBBBBbK..
    ..KBBBBBBBBBbK..
    ..KBBBBBBBBBbK..
    ..KbBBBBBBBBbK..
    ...KbbbbbbbbK...
    ..KdeeeWWeeedK..
    .KdeeeeWWeeeedK.
    .KsKeeeeeeeeKsK.
    ..KKddddddddKK..
""", 16, 14)

# ── 아이: 키가 작고, 뻗친 검은 머리, 빨간 셔츠, 파란 반바지 ─────────────────────
CHILD_DOWN = grid("""
    ................
    ................
    ................
    .....K.KK.K.....
    ....KbKbbKbK....
    ...KbbbbbbbbK...
    ..KbbbbbbbbbbK..
    ..KbsbbssbbsbK..
    ..KbsKssssKsbK..
    ..KbiKssssKibK..
    ...KSssxxssSK...
    ...KxxxxxxxxK...
    ..KsKxxxxxxKsK..
    ...KKVVVVVVKK...
""", 16, 14)

CHILD_RIGHT = grid("""
    ................
    ................
    ................
    ....K.KK.K......
    ...KbKbbKbK.....
    ..KbbbbbbbbK....
    ..KbbbbbbbbbK...
    ..KbbbbbbsbsK...
    ..KbbbbbsKssK...
    ..KbbbbbsKssK...
    ...KbbbSsssiK...
    ....KxxxxxK.....
    ....KxxxsxK.....
    ....KVVVVVK.....
""", 16, 14)

CHILD_UP = grid("""
    ................
    ................
    ................
    .....K.KK.K.....
    ....KbKbbKbK....
    ...KbbbbbbbbK...
    ..KbbbbbbbbbbK..
    ..KbbbbbbbbbbK..
    ..KbbbbbbbbbbK..
    ..KbbbbbbbbbbK..
    ...KbbbbbbbbK...
    ...KxxxxxxxxK...
    ..KsKxxxxxxKsK..
    ...KKVVVVVVKK...
""", 16, 14)


def legs_down_child(p, f, frame):
    # 반바지 아래로 맨다리(피부)가 보인다
    if frame == 0:
        return [f"....K{f}{f}KKssK....", f".....KK.K{f}{f}K...."]
    return [f"....KssKK{f}{f}K....", f"....K{f}{f}K.KK....."]


def legs_side_child(p, f, frame):
    if frame == 0:
        return [f"......KssK......", f"......K{f}{f}{f}K....."]
    return [f".....KsKKsK.....", f"....K{f}{f}K.K{f}{f}K..."]


CHARACTERS = {
    "player": character(PLAYER_DOWN, PLAYER_RIGHT, PLAYER_UP, "N", "B"),
    "nuri": [color_outlines(f) for f in character(NURI_DOWN, NURI_RIGHT, NURI_UP, CH["c1"], CH["l1"])],
    "npc_merchant": character(MERCHANT_DOWN, MERCHANT_RIGHT, MERCHANT_UP, "b", "k"),
    "npc_villager": character(VILLAGER_DOWN, VILLAGER_RIGHT, VILLAGER_UP, "d", "B"),
    "npc_child": character(CHILD_DOWN, CHILD_RIGHT, CHILD_UP, "s", "B", legs_down_child, legs_side_child),
}
