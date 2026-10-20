"""지역 5 보스(32×32 프레임 4개): 밀수꾼 선장.

화풍 통일(docs/art-overhaul/style-guide.md §6.3, 기준 구현 forest_boss.py): 코지 팔레트만 쓰고 auto_outline으로 1px
외곽선. 디자인은 옛 그림 그대로다: 황동 테를 두른 검은 삼각모, 한쪽 눈의 안대, 갈색 수염, 빨간 깃을 세운 짙은 파랑 긴 외투
(지역 강조 blue, 황동 단추), 흰 셔츠, 빨간 허리띠(강조 cloth_red)에 매단 시계 룬(지역 1~4 보스와 같은 황동 테·청록
문자판), 오른손(그림 오른쪽)에 쥔 빨간 장부. 몸은 왼쪽 절반만 그리고 좌우를 맞춘 뒤 비대칭 장식을 얹는다.
빛은 왼쪽 위: 그림 오른쪽(21열부터)은 같은 램프에서 한 단계 어둡게.

프레임(엔진은 맵·전투 모두 4프레임을 그대로 돌린다. 옛 [노려봄, 장부 치켜듦]은 루프 안의 위협 프레임으로 옮긴다):
0 노려봄(눈꺼풀이 반쯤 덮임) → 1 숨 들이쉼(윗몸 1px 들림) → 2 노려봄(문자판 바늘이 한 칸 돎)
→ 3 위협(장부를 4px 치켜들고, 남은 눈을 크게 뜨고 빛나며, 문자판이 환하고, 수염 사이로 이를 드러냄).
"""
from cozypal import c
from monsters import Px

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
    "k": "hair_ink.shade", "K": "hair_ink.base", "L": "hair_ink.hi",     # 삼각모
    "G": "brass.hi", "g": "brass.base", "B": "brass.hi",                 # 모자 테·단추
    "s": "skin.base", "S": "skin.shade", "e": "eye",
    "h": "hair_brown.base", "H": "hair_brown.hi",                         # 수염
    "Q": "blue.shade", "q": "blue.base", "n": "blue.ol",                  # 짙은 파랑 외투(왼쪽 가장자리 밝음)
    "R": "cloth_red.base", "r": "cloth_red.shade",                        # 깃·허리띠
    "W": "cloth_white.hi", "w": "cloth_white.base",                       # 셔츠
    "P": "cloth_white.base", "p": "cloth_white.shade",                    # 바지
    "x": "leather.shade", "X": "leather.base",                            # 장화
}
_DOWN = {"ol": "ol", "shade": "ol", "base": "shade", "hi": "base", "spec": "hi"}

# 안대(왼쪽 위에서 오른쪽 아래로 끈이 지나간다), (16, 9)에 놓는다
_PATCH = ("...k...", "....k..", "...kkkk", "...kkkk", "....kk.")

# 시계 룬: 황동 테 + 청록 문자판, (7, 22)에 놓는다. 바늘(L)은 프레임 2에서 한 칸 돈다
_DIAL = (".hGGh.", "hDdDDh", "GDLDDG", "GDLLDG", "hDDDDh", ".hGGh.")
_DIAL_TURNED = (".hGGh.", "hDdDDh", "GDLDDG", "GDDLLG", "hDDDDh", ".hGGh.")

# 장부: 빨간 표지에 황동 모서리, 아래로 크림 종이 단면
_LEDGER = ("GRRRRRG", "RrrrrrR", "RrGGGrR", "RrrrrrR", "RrGGrrR", "RrrrrrR", "GRRRRRG", "aAAAAAa")


def _rows(p, rows, legend, ox, oy):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != ".":
                p.put(ox + i, oy + j, legend[ch])


def _captain(frame):
    threat = frame == 3
    p = Px(SIZE, SIZE)
    half = [ln.strip() for ln in _HALF.strip("\n").splitlines()]
    full = [r + r[::-1] for r in half]
    _rows(p, full, LEGEND, 0, 0)
    # 오른쪽 그늘(21열부터 한 단계 어둡게)
    for y in range(SIZE):
        for x in range(21, SIZE):
            n = p.get(x, y)
            if n and "." in n and not n.startswith("cloth_white.hi"):
                r, s = n.split(".")
                p.put(x, y, f"{r}.{_DOWN[s]}")
    _rows(p, _PATCH, {"k": "ink"}, 16, 9)
    # 남은 눈(그림 왼쪽, 12열): 0~2는 눈꺼풀이 반쯤 덮은 노려봄, 3은 크게 뜨고 빛남
    if threat:
        p.put(12, 11, "lamp.hi")
        p.put(12, 12, "lamp.spec")
        p.put(11, 11, "hair_brown.shade")                                # 치켜뜬 눈썹
        p.put(13, 10, "hair_brown.shade")
        for x in range(13, 19):                                          # 수염 사이로 드러난 이
            p.put(x, 15, "white" if x % 2 else "cream.hi")
        p.put(12, 15, "void")
        p.put(19, 15, "void")
    else:
        p.put(12, 11, "skin.shade")
        p.put(11, 10, "hair_brown.shade")                                # 내리깐 눈썹
        p.put(12, 10, "hair_brown.shade")
        p.put(13, 11, "hair_brown.shade")
    p.put(10, 4, "hair_ink.spec")                                        # 모자 반짝임
    dial = {"h": "brass.shade", "G": "brass.hi", "D": "teal.hi" if threat else "teal.base",
            "d": "teal.spec" if threat else "teal.hi", "L": "teal.ol"}
    _rows(p, _DIAL_TURNED if frame == 2 else _DIAL, dial, 7, 22)
    # 오른손의 장부와 손. 위협 때 4칸 치켜든다
    lift = 4 if threat else 0
    _rows(p, _LEDGER, {"G": "brass.hi", "R": "cloth_red.base", "r": "cloth_red.shade", "A": "cream.hi",
                       "a": "cream.shade"}, 24, 18 - lift)
    _rows(p, ("sss", "zsz"), {"s": "skin.base", "z": "skin.shade"}, 26, 26 - lift)
    g = p.grid(skip=("sparkle",))
    if frame == 1:                                                       # 숨 들이쉼: 장화 위 윗몸이 1px 들린다
        g = g[1:29] + [g[28]] + g[29:]
    g = [list(r) for r in g]
    if threat:                                                           # 치켜든 장부 위 반짝임(4방향 별)
        for x, y, col in ((29, 11, "sparkle"), (28, 11, "sparkle2"), (30, 11, "sparkle2"), (29, 10, "sparkle2"),
                          (29, 12, "sparkle2")):
            if g[y][x] == ".":
                g[y][x] = c(col)
    return ["".join(r) for r in g]


PORT_BOSSES = {"boss_smuggler_captain": [_captain(i) for i in range(4)]}
