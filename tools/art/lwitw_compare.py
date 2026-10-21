"""LWITW 화풍(결정 37) 캐릭터 전후 비교 이미지(docs/art-overhaul/lwitw-chars-compare.png)를 만든다.

    python tools/art/lwitw_compare.py [기준 커밋]   # 기본: c152f60(LWITW 규칙 적용 전)

전: 기준 커밋의 assets/sprites/{player,nuri}.png(git show로 읽음), 후: 지금 디스크의 시트(build.py로 다시 만든 것).
- 위: 캐릭터 × 방향마다 전/후 6프레임(서기·왼발·서기·오른발 = 걷기 4프레임, 숨쉬기, 깜빡임)을 8배로 나란히
- 아래: 게임 배율 장면(1배 그림을 4배로). 풀·흙길 타일 위에 네 방향 서기와 걷기 4프레임, 전 줄/후 줄
build.py/check.py의 산출물이 아니므로 한 번 만들어 커밋해 두는 문서용 그림이다.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build  # noqa: E402
from charrig import COLS, DIRS  # noqa: E402
from cozypal import c  # noqa: E402
from gridlib import PALETTE, Canvas  # noqa: E402
from png import encode_png, read_png  # noqa: E402

NAMES = ("player", "nuri")
OUT = os.path.join(build.ROOT, "docs", "art-overhaul", "lwitw-chars-compare.png")
FW, FH = 16, 24
BG = (0x2b, 0x24, 0x33, 255)
PANEL = (0x3a, 0x34, 0x46, 255)
GRID = (0x44, 0x3e, 0x52, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)
TXT = (0xee, 0xea, 0xe4, 255)


def to_canvas(w, h, rows):
    cv = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            cv.px[y][x] = tuple(rows[y][x])
    return cv


def sheet_before(rev, name):
    data = subprocess.run(["git", "show", f"{rev}:assets/sprites/{name}.png"], cwd=build.ROOT,
                          check=True, capture_output=True).stdout
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        return to_canvas(*read_png(path))
    finally:
        os.unlink(path)


def sheet_after(name):
    return to_canvas(*read_png(os.path.join(build.ASSETS, "sprites", f"{name}.png")))


def frame(sheet, d, k):
    fr = Canvas(FW, FH)
    for y in range(FH):
        fr.px[y] = sheet.px[d * FH + y][k * FW:(k + 1) * FW]
    return fr


def panel(cv, fr, x, y, s):
    """1px 눈금이 있는 판 위에 프레임을 s배로."""
    cv.fill_rect(x, y, FW * s, FH * s, PANEL)
    for yy in range(0, FH * s, s):
        cv.fill_rect(x, y + yy, FW * s, 1, GRID)
    for xx in range(0, FW * s, s):
        cv.fill_rect(x + xx, y, 1, FH * s, GRID)
    cv.paste(fr, x, y, s)


def scene(sheets, row_label_w=0):
    """게임 배율 장면(1배): 풀 3줄 + 흙길 1줄. 네 방향 서기, 그 옆에 아래·오른쪽 걷기 4프레임."""
    tiles = build.TILES
    cols, rows_n = 26, 4
    sc = Canvas(cols * 16, rows_n * 16)
    for j in range(rows_n):
        for i in range(cols):
            sc.draw(tiles["path" if j == 2 else "grass"], i * 16, j * 16)
    shadow = PALETTE[c("shadow")]
    x = 6
    for n in NAMES:
        sh = sheets[n]
        poses = [(d, 0) for d in range(4)] + [(0, k) for k in range(4)] + [(2, k) for k in range(4)]
        for d, k in poses:
            for dx in range(3, 13):
                sc.put(x + dx, 16 * 2 + 15, shadow)
            sc.paste(frame(sh, d, k), x, 16 * 2 + 16 - FH)
            x += 16
        x += 12
    return sc


def main():
    rev = sys.argv[1] if len(sys.argv) > 1 else "c152f60"
    before = {n: sheet_before(rev, n) for n in NAMES}
    after = {n: sheet_after(n) for n in NAMES}

    S = 8
    cell = FW * S + 6
    side_w = 6 * cell
    label_w = 70
    gap = 40
    W = 16 + label_w + 2 * side_w + gap + 16
    char_h = 30 + 4 * (FH * S + 10)
    SS = 4
    sc_w = 26 * 16 * SS
    sc_h = 4 * 16 * SS
    H = 16 + 30 + len(NAMES) * char_h + 30 + 2 * (sc_h + 30) + 16
    W = max(W, 16 + label_w + sc_w + 16)
    cv = Canvas(W, H, BG)
    build.text(cv, f"lwitw characters  before ({rev}) | after   8x, 1px grid", 16, 16, 2, HEAD)
    y = 46
    x_before = 16 + label_w
    x_after = x_before + side_w + gap
    for n in NAMES:
        build.text(cv, n, 16, y, 2, HEAD)
        build.text(cv, "before", x_before, y, 2, TXT)
        build.text(cv, "after", x_after, y, 2, TXT)
        for k in range(6):
            build.text(cv, COLS[k], x_before + k * cell + 60, y + 4, 1, TXT)
            build.text(cv, COLS[k], x_after + k * cell + 60, y + 4, 1, TXT)
        yy = y + 30
        for d in range(4):
            build.text(cv, DIRS[d], 16, yy + FH * S // 2, 2, TXT)
            for k in range(6):
                panel(cv, frame(before[n], d, k), x_before + k * cell, yy, S)
                panel(cv, frame(after[n], d, k), x_after + k * cell, yy, S)
            yy += FH * S + 10
        y += char_h
    build.text(cv, "game scale (1x art shown at 4x): 4 directions standing + walk down / walk right", 16, y, 2, HEAD)
    y += 30
    for label, sheets in (("before", before), ("after", after)):
        build.text(cv, label, 16, y + sc_h // 2, 2, TXT)
        cv.paste(scene(sheets), 16 + label_w, y, SS)
        y += sc_h + 30
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(encode_png(cv.width, cv.height, cv.rows()))
    print(os.path.relpath(OUT, build.ROOT))


if __name__ == "__main__":
    main()
