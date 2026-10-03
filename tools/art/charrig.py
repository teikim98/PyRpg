"""16×24 캐릭터 리그: 머리·몸통 그리드 + 코드로 그리는 팔·다리 → 6열 × 4행 시트(24프레임).

시트 계약(docs/art-overhaul/plan.md §3)
- 행 = 방향: 0 아래, 1 왼쪽, 2 오른쪽, 3 위
- 열 = 0 서기, 1 왼발, 2 서기, 3 오른발, 4 숨쉬기, 5 눈 깜빡임
- 프레임 순서(sprite_frames가 돌려주는 리스트) = 행 우선: index = 방향 × 6 + 열

세로 배치(서기 기준, 0부터)
- 0~1행: 여백(바보털·포니테일 끝, 외곽선)
- 2~11행: 머리(외곽선 포함 약 11~12px). 머리 그리드는 0행부터 그리고 아래로 내려와도 된다(포니테일 등)
- 12~18행: 몸통(팔 포함)
- 19~22행: 다리·신발, 23행: 발 아래 외곽선(= 땅에 닿는 줄)

걷기 규칙(style-guide.md §6)
- 1·3열(발 딛는 프레임): 윗몸(머리·몸통·팔)이 1px 내려간다. 한쪽 발은 1px 들리고 반대쪽 팔이 앞으로 나온다.
- 4열(숨쉬기): 머리만 1px 내려간다(어깨가 살짝 올라간 듯).
- 5열(깜빡임): 서기 + 눈 감음(눈 점의 위 픽셀을 피부로, 아래 픽셀을 바깥쪽으로 1px 늘린 선).

그리드는 '캐릭터 범례' 문자로 쓴다(아래 LETTERS). 캐릭터마다 범례 → 코지 팔레트 색 이름을 정하고,
합성이 끝난 뒤 한 번에 칠하고 바깥 외곽선(cozypal.auto_outline)을 두른다.
"""
import textwrap

from cozypal import auto_outline, c
from gridlib import mirror, overlay

W, H = 16, 24
COLS = ("stand", "stepA", "stand", "stepB", "breath", "blink")
DIRS = ("down", "left", "right", "up")

# 캐릭터 범례(모든 캐릭터 공통 문자. 색은 캐릭터마다 legend로 정한다)
#   s S z : 피부 기본·밝음·그늘      p : 볼터치     e : 눈 점    w : 눈 반사광    m : 입
#   a A q Q : 머리카락 기본·밝음·그늘·강조
#   t T y : 윗옷 기본·밝음·그늘      c C x : 겉옷(망토·조끼) 기본·밝음·그늘
#   r R u : 장식1 기본·밝음·그늘     g G k : 장식2 기본·밝음·그늘
#   b B n : 바지 기본·밝음·그늘      f F v : 신발 기본·밝음·그늘
#   o : 안쪽 선(재질 외곽선)          . : 투명
LETTERS = "sSzpewmaAqQtTycCxrRugGkbBnfFvo"


def rows(text: str, height: int | None = None):
    """범례 문자 그리드(16칸 폭) → 행 리스트. 폭·문자를 검사한다."""
    out = [ln.strip() for ln in textwrap.dedent(text).strip("\n").splitlines()]
    out = [r for r in out if r and not r.startswith("#")]
    for j, r in enumerate(out):
        if len(r) != W:
            raise ValueError(f"row {j} width {len(r)} != {W}: {r!r}")
        bad = set(r) - set(LETTERS) - {"."}
        if bad:
            raise ValueError(f"row {j}: unknown letters {sorted(bad)}: {r!r}")
    if height is not None and len(out) != height:
        raise ValueError(f"height {len(out)} != {height}")
    return out


def blank(h=H):
    return ["." * W for _ in range(h)]


def put(g, x, y, ch):
    if 0 <= y < len(g) and 0 <= x < W:
        g[y] = g[y][:x] + ch + g[y][x + 1:]


# ── 다리(19~22행) ─────────────────────────────────────────────────────────────────
# 아래·위: 다리 두 개(2px), 사이 2px. 발 딛는 프레임은 한쪽 발이 1px 들린다.
LEGS_FRONT = {
    "stand": rows("""
        .....bn..nb.....
        .....bn..nb.....
        .....Ff..fF.....
        ....vfv..vfv....
    """),
    # A: 화면 왼쪽 다리가 들린다(윗몸이 1px 내려와 19행은 몸통에 가려진다)
    "stepA": rows("""
        .....bn..nb.....
        .....Ff..nb.....
        ....vfv..fF.....
        .........vfv....
    """),
}
LEGS_FRONT["stepB"] = mirror(LEGS_FRONT["stepA"])

# 오른쪽 보기: 서기는 두 다리가 겹치고, 발 딛는 프레임은 앞뒤로 벌린다(먼 다리는 그늘색).
LEGS_SIDE = {
    "stand": rows("""
        ......nbb.......
        ......nbb.......
        ......vfFf......
        ......vfff......
    """),
    # A: 가까운 다리(밝은 색)가 앞으로
    "stepA": rows("""
        ......nbbb......
        .....nn..bb.....
        ....vv....fFf...
        ....vv....fff...
    """),
    # B: 먼 다리(그늘색)가 앞으로, 가까운 다리가 뒤로
    "stepB": rows("""
        ......bbnn......
        .....bb..nn.....
        ...fFf....vvv...
        ...fff....vvv...
    """),
}


def legs(direction, pose):
    if direction in ("down", "up"):
        return LEGS_FRONT[pose]
    g = LEGS_SIDE[pose]
    return mirror(g) if direction == "left" else g


# ── 팔 ───────────────────────────────────────────────────────────────────────────
def arms_front(pose, sleeve="t", sleeve_dark="y", hand="s", x_left=3, x_right=12, top=13):
    """아래·위 보기의 팔: 몸통 양옆 1px 소매 + 손. 발 딛는 프레임에 한쪽 손이 1px 올라가고(뒤로) 반대쪽이 1px
    내려온다(앞으로). stepA = 화면 왼쪽 발이 들림 → 화면 오른쪽 팔이 앞으로."""
    g = blank()
    lens = {"stand": (4, 4), "stepA": (3, 5), "stepB": (5, 3)}[pose]
    for x, n, sc in ((x_left, lens[0], sleeve), (x_right, lens[1], sleeve_dark)):
        for k in range(n - 1):
            put(g, x, top + k, sc)
        put(g, x, top + n - 1, hand)
    return g


def arms_side(pose, sleeve="t", sleeve_dark="y", hand="s", shoulder=(8, 13)):
    """옆 보기의 가까운 팔: 서기는 몸통 위로 곧게 내리고, 발 딛는 프레임은 다리와 반대로 앞뒤로 흔든다.
    stepA(가까운 다리 앞) → 팔은 뒤로, stepB → 팔은 앞으로."""
    g = blank()
    x, y = shoulder
    if pose == "stand":
        pts = [(x, y, sleeve), (x, y + 1, sleeve), (x, y + 2, sleeve_dark), (x, y + 3, hand)]
    elif pose == "stepA":
        pts = [(x, y, sleeve), (x - 1, y + 1, sleeve), (x - 1, y + 2, sleeve_dark), (x - 2, y + 3, hand)]
    else:
        pts = [(x, y, sleeve), (x + 1, y + 1, sleeve), (x + 1, y + 2, sleeve_dark), (x + 2, y + 2, hand)]
    for px, py, ch in pts:
        put(g, px, py, ch)
    return g


def shift_rows(g, dy):
    """그리드를 아래로 dy칸(음수면 위로) 옮긴다. 높이는 24로 맞춘다."""
    out = blank()
    for j, r in enumerate(g):
        if 0 <= j + dy < H:
            out[j + dy] = r
    return out


def pad(g, y0):
    """부분 그리드를 24행 캔버스의 y0행부터 둔다."""
    out = blank()
    for j, r in enumerate(g):
        if 0 <= y0 + j < H:
            out[y0 + j] = r
    return out


def close_eyes(g, face_center=7.5):
    """눈 점(e) 감기: 세로로 이어진 눈 점의 위 픽셀은 피부(s), 맨 아래 픽셀은 남기고 바깥쪽으로 1px 늘린다."""
    out = [list(r) for r in g]
    for y in range(len(g)):
        for x in range(W):
            if g[y][x] != "e":
                continue
            below = y + 1 < len(g) and g[y + 1][x] == "e"
            if below:
                out[y][x] = "s"
            else:
                nx = x - 1 if x < face_center else x + 1
                if 0 <= nx < W and g[y][nx] in "sSzp":
                    out[y][nx] = "e"
    for y in range(len(g)):
        for x in range(W):
            if out[y][x] == "w":
                out[y][x] = "s"
    return ["".join(r) for r in out]


class Rig:
    """캐릭터 하나의 부품 묶음.

    heads/torsos: {"down"|"right"|"up": 행 리스트}. 머리는 0행부터, 몸통은 12행부터 놓인다.
    왼쪽은 오른쪽을 좌우 반전한다(left_heads/left_torsos로 따로 줄 수도 있다: 비대칭 소품).
    arm_front/arm_side: arms_front/arms_side에 넘길 키워드(소매 색 등).
    legend: 범례 문자 → 코지 색 이름.
    behind_up: 위 보기에서 머리보다 먼저(뒤에) 그릴 그리드(없으면 None).
    """

    def __init__(self, legend, heads, torsos, arm_front=None, arm_side=None, left_heads=None, left_torsos=None,
                 torso_y=12, legs_fn=legs, extra=None):
        self.legend = legend
        self.heads = heads
        self.torsos = torsos
        self.left_heads = left_heads or {}
        self.left_torsos = left_torsos or {}
        self.arm_front = arm_front or {}
        self.arm_side = arm_side or {}
        self.torso_y = torso_y
        self.legs_fn = legs_fn
        self.extra = extra  # extra(direction, col, grid) → grid: 캐릭터별 마무리(예: 포니테일 흔들림)

    def part(self, table, left_table, direction):
        if direction == "left":
            if "left" in left_table:
                return left_table["left"]
            return mirror(table["right"])
        return table[direction]

    def frame(self, direction, col):
        pose = COLS[col]
        body_pose = pose if pose in ("stepA", "stepB") else "stand"
        bob = 1 if pose in ("stepA", "stepB") else 0
        head_dy = bob + (1 if pose == "breath" else 0)

        g = blank()
        g = overlay(g, pad(self.legs_fn(direction, body_pose), 19))
        torso = pad(self.part(self.torsos, self.left_torsos, direction), self.torso_y)
        if direction in ("down", "up"):
            arms = arms_front(body_pose, **self.arm_front)
            if direction == "up":
                arms = mirror(arms)
            g = overlay(g, shift_rows(torso, bob))
            g = overlay(g, shift_rows(arms, bob))
        else:
            arms = arms_side(body_pose, **self.arm_side)
            if direction == "left":
                arms = mirror(arms)
            g = overlay(g, shift_rows(torso, bob))
            g = overlay(g, shift_rows(arms, bob))
        head = pad(self.part(self.heads, self.left_heads, direction), 0)
        if pose == "blink":
            head = close_eyes(head)
        g = overlay(g, shift_rows(head, head_dy))
        if self.extra:
            g = self.extra(direction, col, g)
        return g

    def letter_frames(self):
        """24프레임(행 우선) 범례 문자 그리드."""
        return [self.frame(d, k) for d in DIRS for k in range(len(COLS))]

    def frames(self):
        """24프레임 팔레트 문자 그리드(칠하고 외곽선을 두른 결과)."""
        table = {".": "."}
        for k, v in self.legend.items():
            table[k] = c(v)
        out = []
        for g in self.letter_frames():
            try:
                painted = ["".join(table[ch] for ch in r) for r in g]
            except KeyError as e:
                raise ValueError(f"letter {e.args[0]!r} has no color in legend") from None
            out.append(auto_outline(painted))
        return out
