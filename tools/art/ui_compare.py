"""UI 테마(화풍 통일) 전후 비교 이미지: docs/art-overhaul/screens/ui-theme-compare.png.

    python tools/art/ui_compare.py

docs/art-overhaul/screens/ui-<장면>-{before,after}.png(하네스 1300×800, 게임 1280×800 화면)를 왼쪽 위 1280×800으로
자르고 2×2 평균으로 절반 크기로 줄여, 한 줄에 [전 | 후]로 놓는다. 배치는 edge_compare.compare()를 그대로 쓴다.
build.py/check.py의 산출물이 아니라 한 번 만들어 커밋해 두는 문서용 그림이다.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import edge_compare  # noqa: E402
from edge_compare import SCREENS, compare  # noqa: E402
from gridlib import Canvas  # noqa: E402
from png import read_png  # noqa: E402

CROP_W, CROP_H = 1280, 800
# 보여 줄 순서(없는 장면은 건너뛴다)
ORDER = ["game-dialogue", "game-hud", "game-shop", "game-equipment", "dialogue", "hud", "lesson", "lesson-exercise",
         "codex", "battle-wa", "battle-re", "boss", "knockout-banner", "knockout3-confirm", "knockout3-solution",
         "menu", "reward", "recommended"]


def half(path):
    w, h, rows = read_png(path)
    cw, ch = min(w, CROP_W) // 2, min(h, CROP_H) // 2
    c = Canvas(cw, ch)
    for y in range(ch):
        r0, r1 = rows[2 * y], rows[2 * y + 1]
        for x in range(cw):
            ps = (r0[2 * x], r0[2 * x + 1], r1[2 * x], r1[2 * x + 1])
            c.px[y][x] = (sum(p[0] for p in ps) // 4, sum(p[1] for p in ps) // 4, sum(p[2] for p in ps) // 4, 255)
    return c


def main():
    names = [n for n in ORDER if os.path.isfile(os.path.join(SCREENS, f"ui-{n}-before.png"))
             and os.path.isfile(os.path.join(SCREENS, f"ui-{n}-after.png"))]
    if not names:
        raise SystemExit("no ui-*-before/after.png in docs/art-overhaul/screens")
    pairs = [(n, half(os.path.join(SCREENS, f"ui-{n}-before.png")), half(os.path.join(SCREENS, f"ui-{n}-after.png")))
             for n in names]
    edge_compare.SCALE = 1      # 이미 절반으로 줄였으니 그대로 붙인다
    compare(pairs, os.path.join(SCREENS, "ui-theme-compare.png"), "before (navy ui)", "after (cozy ui)")


if __name__ == "__main__":
    main()
