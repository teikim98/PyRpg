"""그래픽 개편 공통 팔레트(코지 팔레트)와 그리기 도구. 모든 새 아트가 이 모듈을 import해서 쓴다.

화풍 원칙(자세한 수치는 docs/art-overhaul/style-guide.md):
- 채도를 낮춘 먼지빛 색이 바탕이고, 식물·반짝임·주인공 일행만 밝게 튄다.
- 재질마다 램프 하나 = [외곽선, 그늘, 기본, 밝음, 강조]. 외곽선은 그 재질의 가장 어두운 색이고 순검정은 쓰지 않는다.
- 어두운 쪽은 보라·남색 쪽으로, 밝은 쪽은 노랑 쪽으로 색상을 살짝 비튼다(hue-shift).

쓰는 법
    from cozypal import RAMPS, c, paint, auto_outline, noise
    c("grass.base")                     # 팔레트 문자 하나(gridlib.Canvas.draw가 그대로 그린다)
    g = paint(text, {"g": "grass.base", "G": "grass.hi"}, 16, 16)   # 지역 범례로 쓴 그리드 → 팔레트 문자 그리드
    g = auto_outline(g)                 # 바깥 외곽선을 닿은 재질의 외곽선 색으로 두른다

색 이름은 "램프.단계"다. 단계: ol(외곽선, 0) · shade(그늘, 1) · base(기본, 2) · hi(밝음, 3) · spec(강조, 4).
숫자로 "grass.2"처럼 써도 된다. 램프 밖의 낱색(SINGLES)은 이름만 쓴다("ink", "eye", "blush" …).

색 이름 → 팔레트 문자는 다른 팔레트(gridlib·nuripal·지역 팔레트)와 겹치지 않는 한자 영역(U+4E00~)에
등록 순서대로 배정한다. 등록 순서가 코드에 고정이라 같은 코드면 언제나 같은 문자·같은 바이트가 나온다.
"""
import textwrap

import nuripal  # noqa: F401  누리 팔레트를 먼저 등록해 문자 충돌 검사가 의미 있게 한다
from gridlib import PALETTE, _rgba

STEPS = ("ol", "shade", "base", "hi", "spec")

# ── 램프: [외곽선, 그늘, 기본, 밝음, 강조] ────────────────────────────────────────────
# 용도는 style-guide.md §2 표와 같다. 새 램프는 끝에 추가한다(앞에 끼우면 문자 배정이 바뀌어 바이트가 달라진다).
RAMPS = {
    # 자연
    "grass":   ("2f4a2a", "4f7a2e", "7da634", "a8c840", "d8e46c"),  # 풀·덤불(가장 밝게 튀는 색)
    "leaf":    ("2a3424", "45552c", "667838", "8c9e48", "b4c068"),  # 짙은 잎·올리브 수풀·나무 그늘
    "moss":    ("263a34", "3e6448", "5e8656", "8aac68", "b8d088"),  # 이끼·물가 풀(청록 쪽 초록)
    "soil":    ("432a33", "6e4549", "9a6662", "bf8a7a", "dab098"),  # 먼지빛 분홍 흙(길 가장자리·화단)
    "sand":    ("5a4436", "947658", "bea07a", "dcc69c", "f2e4bc"),  # 흙길·모래(따뜻한 베이지)
    "stone":   ("2c3240", "4f5866", "78838e", "a3adb2", "d2d6d0"),  # 돌·판석(청회)
    "water":   ("1d3a4c", "2b5c6e", "4386a0", "6cb0be", "b8e0dc"),  # 물(청록)
    "sky":     ("33627a", "5294a8", "78b4c0", "a4d0cc", "d4ece4"),  # 하늘·먼 배경·창문 반사
    # 사람이 만든 것
    "wood":    ("3c2826", "6a4632", "966a44", "c2905a", "e2ba84"),  # 나무 판자·기둥
    "plank":   ("37323a", "625a5a", "8c8478", "b4ab98", "d8d0bc"),  # 바랜 회색 나무
    "cream":   ("48423e", "877e70", "b6ab94", "dcd2b8", "f6f0e0"),  # 크림 금속판·회벽
    "rust":    ("48262a", "86442c", "bc6a32", "de9648", "f4c472"),  # 녹·주황 지붕
    "brick":   ("46222e", "823a48", "b45662", "d87a82", "f2aaa6"),  # 빨간 벽·탁한 분홍
    "blue":    ("1e2858", "2c4a96", "3e70c4", "6a9ee0", "b0d2f2"),  # 파란 판·컨테이너(강조용)
    "teal":    ("1a3a46", "286474", "3c94a0", "70c2c0", "bcecda"),  # 룬·멈춘 시간·청록 장식
    "brass":   ("4a2c1c", "885826", "be8a36", "e6bc5a", "fff0a8"),  # 황동·금속 장식
    "lamp":    ("6a3a1c", "c07a2a", "f0b040", "ffd870", "fff6c0"),  # 등불·불빛·반짝임
    "flower":  ("5e2440", "a84a6a", "dc7894", "f4a8b8", "ffe0e4"),  # 분홍 꽃
    # 사람(캐릭터)
    "skin":    ("7a3e44", "d08a74", "f2bc98", "ffe0c4", "fff4e8"),
    "hair_ink":    ("261e2c", "3e3446", "5a4c5e", "7c6c7c", "a294a0"),  # 검은 갈색 머리(레퍼런스의 짙은 머리)
    "hair_brown":  ("3a2224", "643a2e", "8e5a3c", "b67e50", "d8a670"),
    "hair_ginger": ("5a1e2a", "b0462c", "e07634", "f8a246", "ffd47a"),  # 누리 주황
    "cloth_white": ("4e4a5e", "9894a6", "cecad2", "eeeae4", "fffcf4"),  # 흰 코트(레퍼런스 주인공 옷)
    "cloth_indigo": ("232848", "38487c", "5266a2", "7a90c6", "a8bce2"),  # 주인공 망토
    "cloth_olive": ("2a2c1e", "4a5228", "6c7834", "92a04a", "bcc674"),  # 누리 망토
    "cloth_red":   ("461c2a", "862c3a", "bc4446", "e06c62", "f6a092"),
    "cloth_green": ("1c3630", "2c5844", "44805a", "6aa870", "a0cc90"),
    "cloth_purple": ("2c2240", "4a3a6a", "6c5a94", "9886ba", "c4b4dc"),
    "leather":     ("3a2020", "643628", "8e5434", "b47a4a", "d6a270"),  # 신발·가방·끈
    "denim":       ("1e2a40", "2e4462", "44628a", "6888ae", "9ab2cc"),  # 바지
}

# 램프 밖의 낱색
SINGLES = {
    "ink": "2b2433",        # 기본 외곽선(재질을 모를 때). 순검정 대신
    "ink_cool": "232c3c",   # 차가운 외곽선(물·밤)
    "ink_warm": "3b2a2c",   # 따뜻한 외곽선(나무·흙)
    "void": "221e2b",       # 땅속·깊은 그늘 채움(레퍼런스의 짙은 땅)
    "eye": "2b2433",        # 점 눈(외곽선과 같은 잉크)
    "eye_green": "2f7a48",  # 누리 초록 눈
    "eye_shine": "fffcf4",  # 눈 반사광
    "blush": "f09088",      # 볼터치
    "mouth": "a8505a",
    "white": "fffcf4",      # 순백 대신 따뜻한 흰색
    "sparkle": "fff6b0",    # 떠다니는 반짝임(노랑)
    "sparkle2": "f0d04a",
    "shadow": ("221e2b", 90),   # 발밑 그림자(반투명)
}

# 지역별 강조색 칸(파일럿은 지역 1만 쓴다. 지역 2~6은 확장 단계에서 이 칸을 채워 쓴다)
REGION_ACCENTS = {
    "r01": ("lamp", "teal", "brass"),            # 에코 마을: 등불 호박색 + 메아리 청록 + 시계탑 황동
    "r02": ("moss", "leaf", "brick"),            # 갈림길 숲: 이끼·짙은 잎 + 버섯 빨강
    "r03": ("cloth_purple", "teal", "lamp"),     # 고블린 동굴: 수정 보라 + 얼음 청록 + 횃불
    "r04": ("cloth_indigo", "cream", "brick"),   # 무너진 대도서관: 잉크 남색 + 양피지 + 봉랍 빨강
    "r05": ("blue", "cloth_red", "rust"),        # 교역항: 바다 파랑 + 깃발 빨강 + 녹
    "r06": ("sky", "cloth_purple", "water"),     # 거울 호수: 안개 하늘빛 + 연보라 + 물
}

# ── 문자 배정 ─────────────────────────────────────────────────────────────────────
_POOL = "".join(chr(cp) for cp in range(0x4E00, 0x4E00 + 400))

HEXES = {}          # 색 이름 → hex(알파가 있으면 (hex, alpha))
for _r, _cols in RAMPS.items():
    if len(_cols) != 5:
        raise ValueError(f"ramp {_r} must have 5 colors")
    for _s, _h in zip(STEPS, _cols):
        HEXES[f"{_r}.{_s}"] = _h
for _n, _h in SINGLES.items():
    HEXES[_n] = _h

CH = {}             # 색 이름 → 팔레트 문자
for _i, (_name, _val) in enumerate(HEXES.items()):
    _c = _POOL[_i]
    if _c in PALETTE:
        raise ValueError(f"palette char clash: {_c!r}")
    PALETTE[_c] = _rgba(_val[0], _val[1]) if isinstance(_val, tuple) else _rgba(_val)
    CH[_name] = _c
NAME = {ch: n for n, ch in CH.items()}

# 문자 → 재질(램프 이름). 외곽선 자동 선택에 쓴다
MATERIAL = {ch: n.split(".")[0] for n, ch in CH.items() if "." in n}


def c(name: str) -> str:
    """색 이름("grass.base", "grass.2", "ink") → 팔레트 문자."""
    if name in CH:
        return CH[name]
    if "." in name:
        r, s = name.split(".", 1)
        if s.isdigit():
            return CH[f"{r}.{STEPS[int(s)]}"]
    raise KeyError(f"unknown cozy color {name!r}")


def hexof(name: str) -> str:
    v = HEXES[NAME[c(name)]]
    return v[0] if isinstance(v, tuple) else v


def ramp(name: str):
    """램프 이름 → [외곽선, 그늘, 기본, 밝음, 강조] 팔레트 문자 5개."""
    return [CH[f"{name}.{s}"] for s in STEPS]


def outline_of(ch: str) -> str:
    """팔레트 문자의 재질 외곽선 문자. 램프 밖 색이면 기본 잉크."""
    m = MATERIAL.get(ch)
    return CH[f"{m}.ol"] if m else CH["ink"]


def _lum(ch: str) -> float:
    r, g, b, _ = PALETTE[ch]
    return 0.299 * r + 0.587 * g + 0.114 * b


def paint(text: str, legend: dict, width: int | None = None, height: int | None = None):
    """지역 범례(ASCII 문자 → 색 이름)로 쓴 그리드 → 팔레트 문자 그리드. '.'은 투명.

    범례에 없는 문자는 오류다(오타를 바로 잡으려고). 크기를 주면 함께 검사한다.
    """
    rows = [ln.strip() for ln in textwrap.dedent(text).strip("\n").splitlines()]
    rows = [r for r in rows if r]
    table = {".": "."}
    for k, v in legend.items():
        table[k] = c(v)
    out = []
    for j, r in enumerate(rows):
        if width is not None and len(r) != width:
            raise ValueError(f"row {j} width {len(r)} != {width}: {r!r}")
        try:
            out.append("".join(table[ch] for ch in r))
        except KeyError as e:
            raise ValueError(f"row {j}: {e.args[0]!r} not in legend") from None
    if height is not None and len(out) != height:
        raise ValueError(f"grid height {len(out)} != {height}")
    return out


D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def auto_outline(g, skip=()):
    """불투명 픽셀에 상하좌우로 닿은 투명 픽셀을, 닿은 재질 중 가장 어두운 외곽선 색으로 칠한다.

    skip: 외곽선을 두르지 않을 팔레트 문자(예: 반짝임처럼 떠 있는 점).
    """
    h, w = len(g), len(g[0])
    out = [list(r) for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] != ".":
                continue
            cands = []
            for dx, dy in D4:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    ch = g[ny][nx]
                    if ch != "." and ch not in skip:
                        cands.append(outline_of(ch))
            if cands:
                out[y][x] = min(cands, key=lambda ch: (_lum(ch), ch))
    return ["".join(r) for r in out]


def noise(x: int, y: int, seed: int = 0) -> float:
    """좌표 해시 난수 [0, 1). 같은 (x, y, seed)면 언제나 같은 값(파이썬 버전과 무관)."""
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFFFF) / 0x1000000


def speckle(g, frm: str, to: str, density: float, seed: int = 0, wrap: bool = True):
    """질감 점(닳은 자국·먼지). frm 색 픽셀 중 density 비율을 to 색으로 바꾼다.

    점끼리 상하좌우로 붙지 않게 해서 '점'으로 읽히게 한다. wrap=True면 타일 가장자리를 넘어 이어 붙여도
    점이 붙지 않게 왼쪽·위 이웃만 본다(결정적).
    """
    fc, tc = c(frm), c(to)
    out = [list(r) for r in g]
    h, w = len(g), len(g[0])
    for y in range(h):
        for x in range(w):
            if out[y][x] != fc or noise(x, y, seed) >= density:
                continue
            if (x > 0 and out[y][x - 1] == tc) or (y > 0 and out[y - 1][x] == tc):
                continue
            out[y][x] = tc
    return ["".join(r) for r in out]


def blank(w: int, h: int):
    return ["." * w for _ in range(h)]


def fill(w: int, h: int, name: str):
    return [c(name) * w for _ in range(h)]
