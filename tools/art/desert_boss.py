"""지역 7 보스(32×32 프레임 2개): 모래 전갈(중간 보스)과 모래시계 스핑크스(최종 보스).

- boss_sand_scorpion: 앞에서 본 거대한 붉은 갈색 전갈. 양옆으로 벌린 큰 집게, 몸 아래 다리 셋씩, 등에서 마디진 꼬리가
  오른쪽 위로 휘어 올라가 끝에 금테 모래시계(꼬리 독침 대신)가 달렸다. 프레임 B는 집게를 들어 벌리고 눈이 청록으로
  빛나며 꼬리 끝 모래시계의 모래가 빛난다. 지역 3·5의 게들(옆으로 낮은 몸)과 달리 꼬리가 몸 위로 솟은 세로 실루엣이다.
- boss_hourglass_sphinx: 정면의 스핑크스. 금·남색 줄무늬 머릿수건(네메스), 모래빛 얼굴, 엎드린 사자 몸의 가슴에 시계 룬
  (지역 1~6 보스와 같은 청록 문자판과 금테, 멈춘 바늘), 앞으로 뻗은 두 앞발, 흰 돌 받침. 등 뒤 양옆으로 떨어지다
  공중에 멈춘 모래 폭포(줄기 사이사이 떠 있는 모래알). 프레임 B는 눈과 문자판이 밝아지고 멈춘 모래알이 한 칸 내려간다.
"""
from gridlib import overlay
from desertpal import CH, color_outline, paint

SIZE = 32


def _blank():
    return [["."] * SIZE for _ in range(SIZE)]


def _ellipse(g, cx, cy, rx, ry, color):
    """color(x, y, 정규화 거리 d) → 색 이름(또는 None이면 건너뜀)."""
    for y in range(SIZE):
        for x in range(SIZE):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0:
                c = color(x, y, d)
                if c:
                    g[y][x] = c


def _line(g, pts, color, width=0):
    """꺾은선을 따라 점을 찍는다(width 1이면 아래 칸도 칠해 두께 2)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for k in range(int(n) + 1):
            t = k / n
            x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
            for dy in range(width + 1):
                if 0 <= x < SIZE and 0 <= y + dy < SIZE:
                    g[y + dy][x] = color


def _to_grid(g):
    return ["".join("." if c == "." else CH[c] for c in row) for row in g]


# ── 모래 전갈 ───────────────────────────────────────────────────────────────
_CLAW_KEY = {"5": "r5", "4": "r4", "3": "r3", "2": "r2", "k": "k4"}
_CLAW = """
    ..........
    ..45...5..
    .4553.453.
    .4553.453.
    .45534553.
    ..4555553.
    ..345553..
    ...34443..
    ....333...
"""
_CLAW_OPEN = """
    ..45......
    .4553...5.
    .4553..453
    .4553..453
    .4553..453
    ..455.4553
    ..3455553.
    ...34443..
    ....333...
"""


def _shell(x, y, cx, cy):
    """등딱지 색: 왼쪽 위는 밝게, 오른쪽 아래는 짙게."""
    t = (x - cx) * 0.6 + (y - cy)
    return "r4" if t < -3 else "r3" if t < 0 else "r2" if t < 3 else "k4"


def _sand_scorpion(awake: bool):
    g = _blank()
    lift = 1 if awake else 0
    # 다리(몸 아래로 셋씩, 끝이 가늘다)
    for side in (1, -1):
        def X(v):
            return v if side == 1 else 31 - v
        for pts in (((12, 23), (6, 25), (4, 29)), ((13, 25), (8, 28), (7, 31)), ((14, 26), (11, 29), (11, 31))):
            _line(g, [(X(a), b) for a, b in pts], "k3")
    # 꼬리(등 뒤에서 오른쪽 위로 휘어 오르는 마디 다섯)
    segs = [(16.5, 15.5, 2.5), (18.8, 12.8, 2.2), (20.6, 10.2, 2.0), (21.6, 7.6, 1.9), (21.2, 5.2, 1.7)]
    for cx, cy, r in segs:
        _ellipse(g, cx, cy, r, r * 0.85, lambda x, y, d, cx=cx, cy=cy: "k3" if d > 0.55 else
                 "r5" if (x - cx) + (y - cy) < -1 else "r4" if (x - cx) + (y - cy) < 1 else "r3")
    # 몸(머리가슴 + 배): 넓은 타원
    _ellipse(g, 15.5, 21.5, 7.5, 5.5, lambda x, y, d: "k4" if d > 0.82 else _shell(x, y, 15.5, 20))
    # 등딱지 마디 무늬(가로 홈)
    for y in (19, 22, 25):
        for x in range(10, 22):
            if g[y][x] not in (".", "k4") and abs(x - 15.5) < 6.5 - (y - 21) * 0.3:
                g[y][x] = "k3" if x > 15 else "r2"
    # 집게 팔(양옆, 프레임 B는 한 칸 들어 올림)
    for side in (1, -1):
        def X(v):
            return v if side == 1 else 31 - v
        _line(g, [(X(10), 20), (X(7), 18 - lift), (X(5), 15 - lift)], "r3", 1)
    # 눈(몸 앞쪽 위)
    eye = "i4" if awake else "g4"
    for x in (13, 18):
        g[19][x] = eye
        g[19][x + 1] = "i5" if awake else "g3"
    out = color_outline(_to_grid(g))
    # 집게: 위로 벌린 두 손가락(프레임 B는 더 벌림). 왼쪽 그림을 좌우로 뒤집어 오른쪽에도
    claw = paint(_CLAW_OPEN if awake else _CLAW, _CLAW_KEY, 10, 9)
    claw = color_outline(claw)
    out = overlay(out, claw, 0, 7 - lift)
    out = overlay(out, [r[::-1] for r in claw], 22, 7 - lift)
    # 꼬리 끝 모래시계(금테 위·아래 가로대, 기둥, 유리 속 모래)
    sand = "i4" if awake else "d5"
    glass = paint(f"""
        GGGGGGG
        g.ccc.h
        g.sSs.h
        g..s..h
        g..c..h
        g.cSc.h
        hhhhhhh
    """, {"G": "g4", "g": "g3", "h": "g1", "c": "i3", "s": "d5", "S": sand}, 7, 7)
    return overlay(out, color_outline(glass + ["......."]), 18, 0)


# ── 모래시계 스핑크스 ────────────────────────────────────────────────────────
def _hourglass_sphinx(awake: bool):
    falls = _blank()
    g = _blank()
    ph = 1 if awake else 0
    # 등 뒤 멈춘 모래 폭포: 양옆 줄기 넷(외곽선 없이 몸 뒤에 깐다). 줄기는 군데군데 끊겨 그 틈에 모래알이 떠 있다
    for x0, top, bottom in ((1, 0, 22), (4, 3, 18), (27, 3, 18), (30, 0, 22)):
        for y in range(top, bottom):
            k = (y + ph) % 6
            if k == 0:
                continue
            falls[y][x0] = "d5" if k in (1, 2) else "d4" if k in (3, 4) else "d3"
        for y in range(bottom + 1, bottom + 6, 2):
            falls[(y + ph) % SIZE][x0] = "d6"  # 공중에 멈춘 모래알
    # 몸통(엎드린 사자, 정면): 넓은 어깨와 가슴
    _ellipse(g, 15.5, 21.5, 11.0, 7.5,
             lambda x, y, d: "d2" if d > 0.85 else ("d5" if x < 13 and y < 21 else "d4" if x < 19 else "d3"))
    # 앞발 둘(앞으로 뻗음)과 발가락
    for cx in (9.0, 22.0):
        _ellipse(g, cx, 27.5, 4.2, 2.6, lambda x, y, d, cx=cx: "d2" if d > 0.75 else ("d5" if x < cx else "d4"))
        for dx in (-2, 0, 2):
            g[29][int(cx) + dx] = "d2"
    # 받침돌
    for y in (30, 31):
        for x in range(3, 29):
            g[y][x] = "b3" if y == 30 else "b1"
    # 머릿수건(네메스): 금·남색 세로 줄무늬, 어깨로 퍼짐
    _ellipse(g, 15.5, 8.0, 7.5, 7.0,
             lambda x, y, d: ("g3" if (x // 2) % 2 == 0 else "v3") if y >= 3 else ("g4" if (x // 2) % 2 == 0 else "v4"))
    for y in range(10, 17):
        w = 8 + (y - 10) // 2
        for x in range(int(15.5 - w), int(15.5 + w) + 1):
            if g[y][x] in (".", "d2", "d3", "d4", "d5"):
                g[y][x] = "g3" if (x // 2) % 2 == 0 else "v3"
    # 얼굴(모래빛), 눈, 코 그늘, 입, 수염
    for y in range(5, 14):
        half = 3 if y < 12 else 2
        for x in range(16 - half - 1, 16 + half):
            g[y][x] = "d5" if x < 15 else "d4"
    eye = "i4" if awake else "k1"
    for x in (13, 17):
        g[8][x] = eye
        g[8][x + 1] = "i5" if awake else "k2"
    g[9][15] = "d3"
    g[10][15] = "d3"
    g[11][14] = g[11][16] = "d2"
    g[11][15] = "d1"
    for y in (13, 14, 15):
        g[y][15] = "g3"
        g[y][16] = "g2"
    # 머리띠의 금 코브라 장식
    g[3][15] = g[3][16] = "g5"
    g[2][15] = "g4"
    out = overlay(_to_grid(falls), color_outline(_to_grid(g)))
    # 가슴의 시계 룬(금테, 청록 문자판, 멈춘 바늘)
    dial = paint("""
        ..hGGh..
        .hDDdDh.
        hDDLDDDh
        GDDLDDDG
        GDDLLLDG
        hDDDDDDh
        .hDDDDh.
        ..hGGh..
    """, {"h": "g2", "G": "g4", "D": "i3" if awake else "i2", "d": "i5" if awake else "i4", "L": "i0"}, 8, 8)
    return overlay(out, dial, 12, 17)


DESERT_BOSSES = {
    "boss_sand_scorpion": [_sand_scorpion(False), _sand_scorpion(True)],
    "boss_hourglass_sphinx": [_hourglass_sphinx(False), _hourglass_sphinx(True)],
}
