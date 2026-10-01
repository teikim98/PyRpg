"""도트 그리드 도구: 공용 팔레트, 문자 그리드 파싱·합성, RGBA 캔버스.

그리드는 문자열 행의 리스트다. 문자 하나가 픽셀 하나이고, 문자는 PALETTE의 키다.
'.'은 투명이다. 문자 단위로 합성(overlay)·좌우 반전·색 바꾸기를 한 뒤 Canvas에 찍는다.
"""
import textwrap

# 공용 팔레트(투명 제외 36색). 아늑한 16비트 판타지 마을 + 멈춘 시간을 뜻하는 청록 계열.
HEX = {
    "K": "1c1424",  # 외곽선(아주 짙은 자주 검정)
    "k": "3a2f45",  # 짙은 그림자
    "g": "5f5a6e",  # 돌 어두움
    "G": "8c8a99",  # 돌 중간
    "H": "b9b8c2",  # 돌 밝음
    "W": "f4efe2",  # 흰색(따뜻한)
    "s": "f6cfa6",  # 피부
    "S": "d99a74",  # 피부 그림자
    "b": "4a2e22",  # 짙은 갈색
    "B": "7a4a2e",  # 갈색
    "n": "a8743f",  # 밝은 나무
    "N": "d8b07a",  # 모래·황갈
    "m": "ecd29c",  # 밝은 모래
    "d": "24503a",  # 짙은 초록
    "e": "3f7f3c",  # 초록
    "E": "6aa84a",  # 풀 밝음
    "l": "a6d05a",  # 연두 하이라이트
    "o": "545a26",  # 올리브 어두움
    "O": "7f8a34",  # 올리브
    "Q": "a9b14e",  # 올리브 밝음
    "r": "a8461f",  # 녹슨 주황(어두움)
    "R": "e57a2a",  # 주황
    "y": "f7b04a",  # 밝은 주황
    "u": "8c6424",  # 황동 어두움
    "U": "cfa042",  # 황동
    "Y": "f6dc7c",  # 금빛 하이라이트
    "x": "c23b3b",  # 빨강
    "X": "7a2433",  # 짙은 빨강
    "i": "ee8ea6",  # 분홍
    "t": "1f5f78",  # 청록 어두움
    "T": "3fa7bf",  # 청록
    "c": "a6ecf2",  # 얼음빛
    "v": "2b3a6b",  # 남색
    "V": "4c6fb3",  # 파랑
    "p": "5b3f80",  # 보라
    "P": "9b7fd0",  # 연보라
}

TRANSPARENT = (0, 0, 0, 0)


def _rgba(h: str, a: int = 255):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


PALETTE = {k: _rgba(v) for k, v in HEX.items()}
PALETTE["."] = TRANSPARENT
# 반투명(메아리 유령 몸통 등). 대문자/소문자와 겹치지 않게 숫자를 쓴다.
PALETTE["1"] = _rgba(HEX["c"], 200)
PALETTE["3"] = _rgba(HEX["W"], 150)


def grid(text: str, width: int | None = None, height: int | None = None):
    """여러 줄 문자열 → 행 리스트. 행 길이가 모두 같은지(그리고 주어진 크기인지) 확인한다."""
    rows = [line.strip() for line in textwrap.dedent(text).strip("\n").splitlines()]
    rows = [r for r in rows if r]
    w = len(rows[0])
    for i, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(f"row {i} has width {len(r)}, expected {w}: {r!r}")
        for ch in r:
            if ch not in PALETTE:
                raise ValueError(f"row {i}: unknown color {ch!r}")
    if width is not None and w != width:
        raise ValueError(f"grid width {w} != {width}")
    if height is not None and len(rows) != height:
        raise ValueError(f"grid height {len(rows)} != {height}")
    return rows


def mirror(g):
    return [r[::-1] for r in g]


def recolor(g, mapping: dict):
    table = str.maketrans(mapping)
    return [r.translate(table) for r in g]


def overlay(base, top, x: int = 0, y: int = 0):
    """top의 '.'이 아닌 문자를 base 위 (x, y)에 덮어쓴 새 그리드."""
    out = [list(r) for r in base]
    for j, row in enumerate(top):
        for i, ch in enumerate(row):
            if ch != "." and 0 <= y + j < len(out) and 0 <= x + i < len(out[0]):
                out[y + j][x + i] = ch
    return ["".join(r) for r in out]


def shift(g, dx: int = 0, dy: int = 0):
    """그리드 내용을 (dx, dy)만큼 옮긴다. 빈 자리는 투명."""
    h, w = len(g), len(g[0])
    blank = ["." * w for _ in range(h)]
    return overlay(blank, g, dx, dy)


def outline(g, color: str = "K"):
    """불투명 픽셀에 상하좌우로 닿은 투명 픽셀을 외곽선 색으로 칠한다."""
    h, w = len(g), len(g[0])
    out = [list(r) for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] != ".":
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and g[ny][nx] not in ".":
                    out[y][x] = color
                    break
    return ["".join(r) for r in out]


class Canvas:
    def __init__(self, width: int, height: int, fill=TRANSPARENT):
        self.width = width
        self.height = height
        self.px = [[fill] * width for _ in range(height)]

    def put(self, x: int, y: int, c):
        if 0 <= x < self.width and 0 <= y < self.height:
            a = c[3]
            if a == 255:
                self.px[y][x] = c
            elif a > 0:
                d = self.px[y][x]
                da = d[3] / 255
                sa = a / 255
                oa = sa + da * (1 - sa)
                mix = [round((c[i] * sa + d[i] * da * (1 - sa)) / oa) for i in range(3)]
                self.px[y][x] = (mix[0], mix[1], mix[2], round(oa * 255))

    def draw(self, g, x: int = 0, y: int = 0):
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch != ".":
                    self.put(x + i, y + j, PALETTE[ch])
        return self

    def paste(self, other: "Canvas", x: int, y: int, scale: int = 1):
        for j in range(other.height):
            for i in range(other.width):
                c = other.px[j][i]
                if c[3] == 0:
                    continue
                for sy in range(scale):
                    for sx in range(scale):
                        self.put(x + i * scale + sx, y + j * scale + sy, c)
        return self

    def fill_rect(self, x: int, y: int, w: int, h: int, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, c)
        return self

    def rows(self):
        return [list(r) for r in self.px]


def sheet(frames, fw: int, fh: int) -> Canvas:
    """그리드 프레임들을 가로로 이어 붙인 시트."""
    c = Canvas(fw * len(frames), fh)
    for i, f in enumerate(frames):
        if len(f) != fh or len(f[0]) != fw:
            raise ValueError(f"frame {i} is {len(f[0])}x{len(f)}, expected {fw}x{fh}")
        c.draw(f, i * fw, 0)
    return c
