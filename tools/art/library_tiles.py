"""지역 4(무너진 대도서관) 지형 타일(16×16). manifest의 overworld 타일셋 끝에 이 순서대로 붙는다.

- 바닥류(lib_floor 마루, lib_carpet 포도주색 카펫, floating_pages 떠 있는 페이지)는 가장자리가 이어지게 그린다.
- 벽은 두 가지: 바닥과 맞닿은 앞면(lib_wall: 몰딩 + 돌 벽 + 나무 징두리 판벽 + 걸레받이)과
  그 뒤 무너진 천장 쪽의 벽 윗면(lib_wall_top: 짙은 돌 블록에 부러진 들보). 맵 생성기가 바로 아래 칸을 보고 고른다.
- bookshelf는 칸 전체를 채우는 책장(위아래 두 칸에 책). 가로·세로로 이어 붙이면 책장 벽이 된다.
  shelf_gap(지나갈 수 있음)은 책장과 거의 같지만 아래 칸 가운데 책 세 권이 빠져 깊은 어둠이 보이고,
  그 안에서 찬 바람 반짝임(청록 한 점)이 샌다. 멀리서는 책장, 자세히 보면 빈칸.
- 물체류(bookshelf_fallen, book_pile, reading_desk, candle_frozen, broken_pillar)는 마루를 깔고
  색 외곽선을 두른 물체를 얹는다.
"""
from forestpal import Rng
from gridlib import overlay
from librarypal import CH, color_outline, paint

# ── 마루: 가로로 놓인 널 네 장(4줄씩), 이음매는 엇갈린다. 스프라이트가 잘 보이게 대비는 낮게 ─────────
def _planks():
    g = [[3] * 16 for _ in range(16)]
    joints = {0: 5, 1: 13, 2: 9, 3: 1}
    rng = Rng(41)
    for p in range(4):
        y0 = p * 4
        j = joints[p]
        for x in range(16):
            g[y0][x] = 4
            g[y0 + 3][x] = 2
        for y in range(y0, y0 + 3):
            g[y][j] = 1
        g[y0][(j + 1) % 16] = 5
        # 나뭇결: 널마다 짧은 어두운 결 두 개
        for _ in range(2):
            x = rng.randint(0, 13)
            y = y0 + 1 + rng.randint(0, 1)
            for k in range(rng.randint(2, 3)):
                if g[y][(x + k) % 16] == 3:
                    g[y][(x + k) % 16] = 2
    return g


def _ramp_rows(g, ramp: str):
    return ["".join(CH[f"{ramp}{v}"] for v in row) for row in g]


LIB_FLOOR = _ramp_rows(_planks(), "w")


# ── 카펫: 포도주색 바탕에 금실 마름모 격자, 가운데 금 무늬. 사방으로 이어진다 ──────────────────
def _carpet():
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            d = abs(x + 0.5 - 8) + abs(y + 0.5 - 8)
            if d == 8:
                c = "g2"
            elif d == 7 or d == 9:
                c = "r1"
            elif d <= 1:
                c = "g4"
            elif d == 2:
                c = "g2"
            elif d == 3:
                c = "r3"
            elif d >= 15:
                c = "g3"
            elif d == 14:
                c = "r3"
            else:
                c = "r2"
            line.append(CH[c])
        rows.append("".join(line))
    return rows


LIB_CARPET = _carpet()

# ── 벽 앞면: 위 몰딩, 돌 블록 벽, 나무 난간대, 징두리 판벽(판 두 장), 걸레받이 ─────────────────
WALL_KEY = {"M": "w5", "m": "w3", "n": "w1", "S": "s4", "s": "s3", "t": "s2", "u": "s1",
            "R": "w5", "r": "w4", "P": "w4", "p": "w3", "q": "w2", "z": "w1", "Z": "w0"}
LIB_WALL = paint("""
    MMMMMMMMMMMMMMMM
    nnnnnnnnnnnnnnnn
    SSSSSSStSSSSSSSt
    sssssssusssssssu
    sssssssusssssssu
    ttttttttttttttut
    SSSStSSSSSSStSSS
    ssssusssssssusss
    uuuuuuuuuuuuuuuu
    RRRRRRRRRRRRRRRR
    qqqqqqqqqqqqqqqq
    zPPPPPpzzPPPPPpz
    zPppppqzzPppppqz
    zPppppqzzPppppqz
    zpqqqqqzzpqqqqqz
    ZZZZZZZZZZZZZZZZ
""", WALL_KEY, 16, 16)


# ── 벽 윗면: 무너진 천장 쪽 짙은 돌 블록, 대각선으로 걸친 부러진 들보 조각. 사방으로 이어진다 ─────────
def _wall_top():
    g = [[1] * 16 for _ in range(16)]
    # 큰 돌 블록(8×6, 줄마다 엇갈림)
    for y in range(16):
        for x in range(16):
            row = y // 6 if y < 12 else 2
            off = 4 if row % 2 else 0
            if y % 6 == 0 or (x + off) % 8 == 0:
                g[y][x] = 0
            elif y % 6 == 1 or (x + off) % 8 == 1:
                g[y][x] = 2
    # 무너진 천장에서 떨어진 부스러기 몇 점(밝은 돌)
    for x, y in ((4, 3), (11, 9), (13, 14), (2, 13)):
        g[y][x] = 3
    return _ramp_rows(g, "s")


LIB_WALL_TOP = _wall_top()

# ── 책장: 위 장식 몰딩, 두 칸에 빽빽한 책(빨강·파랑·초록·가죽·양피지, 금박 띠), 옆기둥 ────────────
SHELF_KEY = {"O": "w5", "o": "w4", "p": "w3", "q": "w2", "z": "w1", "Z": "w0",
             "R": "r3", "r": "r2", "E": "e3", "e": "e2", "U": "u3", "u": "u2", "A": "a3", "a": "a2",
             "L": "w6", "l": "w5", "G": "g4", "g": "g2", "x": "k0", "t": "i3", "T": "i4"}
_SHELF_ROWS = [
    "OOOOOOOOOOOOOOOo",
    "pqqqqqqqqqqqqqqz",
    "pRrZZZZLlZZEeZZz",
    "pRrRrUuLlZZEeUuz",
    "pGgRrUuLlAaEeUuz",
    "pRrGgUuGgAaEeGgz",
    "pRrRrUuLlAaEeUuz",
    "poooooooooooooqz",
    "pqqqqqqqqqqqqqqz",
    "pEeZZRrZZLlZZEez",
    "pEeAaRrZZLlRrEez",
    "pGgAaRrUuGgRrGgz",
    "pEeAaGgUuLlGgEez",
    "pEeAaRrUuLlRrEez",
    "poooooooooooooqz",
    "zzzzzzzzzzzzzzzz",
]
BOOKSHELF = paint("\n".join(_SHELF_ROWS), SHELF_KEY, 16, 16)

# 빈 책장 칸(숨겨진 길): 아래 칸 가운데 책 세 권(x5~10)이 빠지고 뒤판도 없어 깊은 어둠이 보인다.
# 어둠 속에 찬 바람 반짝임 하나(청록), 빈칸 바닥에 먼지 자국(밝은 널 한 줄)
_GAP_ROWS = list(_SHELF_ROWS)
_GAP_ROWS[9] = "pEeZZRr" + "ZZZZ" + "ZZEez"
_GAP_ROWS[10] = "pEeAaRr" + "ZxxZ" + "RrEez"
_GAP_ROWS[11] = "pGgAaRr" + "ZxTZ" + "RrGgz"
_GAP_ROWS[12] = "pEeAaGg" + "ZxxZ" + "GgEez"
_GAP_ROWS[13] = "pEeAaRr" + "Zxxt" + "RrEez"
_GAP_ROWS[14] = "poooooo" + "OOOO" + "oooqz"
SHELF_GAP = paint("\n".join(_GAP_ROWS), SHELF_KEY, 16, 16)


def on_floor(text: str, legend: dict, base=None, outline: bool = True):
    """마루 위에 물체를 얹는다. '_'·'-'는 외곽선 없이 바닥에 직접 칠하는 그림자."""
    shadow_key = {"_": "w2", "-": "w1"}
    obj_rows, shadow_rows = [], []
    for line in [r.strip() for r in text.strip("\n").splitlines() if r.strip()]:
        obj_rows.append("".join("." if ch in shadow_key else ch for ch in line))
        shadow_rows.append("".join(ch if ch in shadow_key else "." for ch in line))
    obj = paint("\n".join(obj_rows), legend, 16, 16)
    if outline:
        obj = color_outline(obj)
    shadow = paint("\n".join(shadow_rows), shadow_key, 16, 16)
    return overlay(overlay(base or LIB_FLOOR, shadow), obj)


# ── 쓰러진 책장: 뒤판을 위로 하고 비스듬히 누운 책장, 앞으로 쏟아진 책들 ────────────────────
FALLEN_KEY = {"O": "w5", "o": "w4", "p": "w3", "q": "w2", "z": "w1",
              "R": "r3", "r": "r2", "E": "e3", "e": "e2", "U": "u3", "u": "u2", "A": "a4", "a": "a3", "G": "g4"}
BOOKSHELF_FALLEN = on_floor("""
    ................
    ................
    ..........Oo....
    ......OOoopqo...
    ..OOooppqpqpz...
    .Oopqpqpqpqpqz..
    .opqpqpqpqpqpz..
    .opqpqpqpqpqqz..
    .opqpqpqpqqzz...
    .zqpqpqqzzz.....
    ..zzzzzz..RU....
    ...EeAa..Rruu...
    ..Ee.Aa_UuGr__..
    ..__..__Uu___...
    ........__......
    ................
""", FALLEN_KEY)

# ── 책 더미: 크기가 다른 책 다섯 권이 엇갈려 쌓였다. 옆에 펼쳐진 책 한 권 ─────────────────
PILE_KEY = {"R": "r3", "r": "r2", "x": "r1", "E": "e3", "e": "e2", "U": "u3", "u": "u2", "A": "a4", "a": "a3",
            "b": "a2", "L": "w5", "l": "w4", "G": "g4", "g": "g2", "t": "a1"}
BOOK_PILE = on_floor("""
    ................
    ................
    ......LLLLl.....
    ......aaaal.....
    .....RRRRRRr....
    .....aaaaaar....
    ....UUUUUUUu....
    ....GgUUUUUu....
    ...EEEEEEEEe....
    ...aaaaaaaae....
    ...RRRRRRRRRRr..
    ...RRGgRRRRRRr..
    ..aaaaaaaaaaaar.
    ..xxxxxxxxxxxxx.
    ..______________
    ................
""", PILE_KEY)

# ── 열람 책상: 나무 상판(3/4 시점), 펼쳐진 책(글줄), 오른쪽에 청록 서리 낀 작은 초 ───────────────
DESK_KEY = {"O": "w6", "o": "w5", "p": "w4", "P": "w3", "q": "w2", "z": "w1",
            "A": "a5", "a": "a4", "b": "a3", "t": "a1", "c": "c3", "C": "c1",
            "i": "i3", "I": "i5", "f": "f2", "F": "f3"}
READING_DESK = on_floor("""
    ................
    ................
    ............i...
    ...........iFi..
    ...........ifi..
    ............c...
    ..ooAAaabbo.cC..
    .oOOAtAatbOooo..
    .oOOAAaabbOOoo..
    .ppppppppppppp..
    .PPPPPPPPPPPPP..
    .qzqqqqqqqqqzq..
    .qz.........zq..
    .zz.........zz..
    .__.........__..
    ................
""", DESK_KEY)

# ── 얼어붙은 촛대: 놋쇠 촛대에 초 세 자루, 불꽃은 청록 서리 속에 멈췄다 ─────────────────────
CANDLE_KEY = {"G": "g4", "g": "g3", "h": "g2", "j": "g1", "c": "c3", "C": "c2", "d": "c1",
              "f": "f1", "F": "f2", "Y": "f3", "i": "i2", "I": "i3", "J": "i4", "W": "i5"}
CANDLE_FROZEN = on_floor("""
    .......J........
    ..J...IYI...J...
    .IYI..JFJ..IYI..
    .JFJ..IfI..JFJ..
    .IfI...c...IfI..
    ..c....C....c...
    ..C....C....C...
    .GgGG..C..GGgh..
    ...hGGGgGGGh....
    ......GgG.......
    .......g........
    .......g........
    ......Ggh.......
    .....GGghj......
    ....__jjj__.....
    ................
""", CANDLE_KEY)

# ── 부러진 기둥: 홈 파인 돌기둥이 비스듬히 부러졌다. 받침돌과 떨어진 돌 조각 ──────────────────
PILLAR_KEY = {"1": "s2", "2": "s3", "3": "s4", "4": "s5", "5": "s6", "0": "s1"}
BROKEN_PILLAR = on_floor("""
    ................
    ................
    ....5.4.........
    ....543.42......
    ....5432322.....
    ....543232......
    ....543232......
    ....543232......
    ....543232......
    ....543232......
    ...55443322.....
    ..5444333221.3..
    ..4333222110.21.
    ..___________-..
    ................
    ................
""", PILLAR_KEY)

# ── 떠 있는 페이지: 마루 위에 멈춘 채 떠 있는 종이 석 장(청록 서리 테), 바닥에 비친 그림자 ─────────
PAGE_KEY = {"A": "a5", "a": "a4", "b": "a3", "t": "a1", "i": "i3", "I": "i4", "_": "w2", "-": "w1"}
_PAGES = paint("""
    ................
    ..IaaI..........
    ..atab..........
    ..aaab......I...
    ..Iab......aA...
    ..........abtI..
    ...........ab...
    ................
    ................
    .....IAa........
    ....aatab.......
    ....Iaab........
    ................
    ................
    ................
    ................
""", PAGE_KEY, 16, 16)
_PAGE_SHADOW = paint("""
    ................
    ................
    ................
    ................
    ................
    ..____..........
    ................
    ................
    ...........__...
    ................
    ................
    ................
    ................
    .....___........
    ................
    ................
""", PAGE_KEY, 16, 16)
FLOATING_PAGES = overlay(overlay(LIB_FLOOR, _PAGE_SHADOW), _PAGES)

LIBRARY_TILES = {
    "lib_floor": LIB_FLOOR,
    "lib_carpet": LIB_CARPET,
    "lib_wall": LIB_WALL,
    "lib_wall_top": LIB_WALL_TOP,
    "bookshelf": BOOKSHELF,
    "bookshelf_fallen": BOOKSHELF_FALLEN,
    "book_pile": BOOK_PILE,
    "reading_desk": READING_DESK,
    "candle_frozen": CANDLE_FROZEN,
    "broken_pillar": BROKEN_PILLAR,
    "floating_pages": FLOATING_PAGES,
    "shelf_gap": SHELF_GAP,
}
