"""경계 장식(결정 20) 전후 비교 이미지: docs/art-overhaul/edges-before-after.png.

    npx playwright test tests/e2e/edges.spec.ts   # docs/art-overhaul/screens/edges-rNN-{before,after}.png
    python tools/art/edge_compare.py

E2E가 하네스(dev/world.html, 960×540 = 내부 320×180의 3배)에서 찍은 지역 1~6 화면을 내부 해상도로 줄여
(3×3 칸의 가운데 픽셀) 한 줄에 [장식 없음 | 장식 있음]을 2배로 놓는다. build.py/check.py의 산출물이 아니라
한 번 만들어 커밋해 두는 문서용 그림이다.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build  # noqa: E402
from build import text  # noqa: E402
from gridlib import Canvas  # noqa: E402
from png import encode_png, read_png  # noqa: E402

SCREENS = os.path.join(build.ROOT, "docs", "art-overhaul", "screens")
OUT = os.path.join(build.ROOT, "docs", "art-overhaul", "edges-before-after.png")
REGIONS = [("r01", "r01 echo village"), ("r02", "r02 crossroad forest"), ("r03", "r03 goblin cave"),
           ("r04", "r04 grand library"), ("r05", "r05 trade port"), ("r06", "r06 mirror lake")]
ZOOM = 3      # 하네스 화면 배율
SCALE = 2     # 비교 이미지 배율
BG = (0x2b, 0x24, 0x33, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)


def shrink(path):
    w, h, rows = read_png(path)
    c = Canvas(w // ZOOM, h // ZOOM)
    for y in range(c.height):
        for x in range(c.width):
            p = rows[y * ZOOM + ZOOM // 2][x * ZOOM + ZOOM // 2]
            c.px[y][x] = (p[0], p[1], p[2], 255)
    return c


def main():
    pairs = []
    for key, label in REGIONS:
        a = os.path.join(SCREENS, f"edges-{key}-before.png")
        b = os.path.join(SCREENS, f"edges-{key}-after.png")
        if os.path.isfile(a) and os.path.isfile(b):
            pairs.append((label, shrink(a), shrink(b)))
    if not pairs:
        raise SystemExit("no edges-rNN-before/after.png in docs/art-overhaul/screens (run tests/e2e/edges.spec.ts)")
    pad, head, gap = 12, 22, 12
    fw, fh = pairs[0][1].width * SCALE, pairs[0][1].height * SCALE
    cv = Canvas(pad * 2 + fw * 2 + gap, pad + head + len(pairs) * (fh + head + pad), BG)
    text(cv, "before (edges off)", pad, pad, 2, HEAD)
    text(cv, "after (edges on)", pad + fw + gap, pad, 2, HEAD)
    y = pad + head
    for label, a, b in pairs:
        text(cv, label, pad, y + 2, 2)
        cv.paste(a, pad, y + head, SCALE)
        cv.paste(b, pad + fw + gap, y + head, SCALE)
        y += fh + head + pad
    with open(OUT, "wb") as f:
        f.write(encode_png(cv.width, cv.height, cv.rows()))
    print(os.path.relpath(OUT, build.ROOT), f"{cv.width}x{cv.height}")


if __name__ == "__main__":
    main()
