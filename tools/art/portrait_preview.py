"""그래픽 개편 미리보기: 누리 초상화 전/후 비교(docs/art-overhaul/portraits.png, 검토용이고 게임 에셋이 아니다).

    python tools/art/portrait_preview.py [기준 커밋]   # 기본: dfa7f94(개편 전 마지막 초상화)

1줄: 기준 커밋의 초상화 5종(git show로 읽음), 2줄: 지금 portraits.py가 그리는 초상화. 둘 다 3배(대화창 192px).
3줄: 실제 화면 크기 — 대화창(3배)·전투·레슨(2배)처럼 짙은 남색 바탕 + 크림 테두리 위에 놓은 모습과,
     같은 누리의 걷기 시트 프레임(아래 보기 서기·깜빡임, 8배)을 나란히 놓아 색·특징이 맞는지 본다.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from build import text  # noqa: E402
from characters import CHARACTERS  # noqa: E402
from gridlib import Canvas  # noqa: E402
from png import encode_png, read_png  # noqa: E402
from portraits import PORTRAITS  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "docs", "art-overhaul", "portraits.png")
EXPR = ("neutral", "happy", "surprised", "worried", "serious")

BG = (0x2b, 0x24, 0x33, 255)
PANEL = (0x3a, 0x34, 0x46, 255)
HEAD = (0xf6, 0xdc, 0x7c, 255)
DIM = (0xa2, 0x94, 0xa0, 255)
NAVY = (0x0d, 0x12, 0x26, 255)     # src/ui/styles.css --navy-900(초상화 바탕)
BORDER = (0xe9, 0xe3, 0xc9, 255)   # --border


def old_canvas(rev, rel):
    data = subprocess.run(["git", "show", f"{rev}:assets/{rel}"], cwd=ROOT, check=True, capture_output=True).stdout
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        w, h, rows = read_png(path)
    finally:
        os.unlink(path)
    cv = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            cv.px[y][x] = tuple(rows[y][x])
    return cv


def framed(cv, p, x, y, s):
    """게임 UI처럼: 남색 바탕 + 3px 크림 테두리."""
    size = p.width * s
    cv.fill_rect(x - 3, y - 3, size + 6, size + 6, BORDER)
    cv.fill_rect(x, y, size, size, NAVY)
    cv.paste(p, x, y, s)


def main():
    rev = sys.argv[1] if len(sys.argv) > 1 else "dfa7f94"
    S, pad, gap = 3, 16, 12
    box = 64 * S
    W = pad * 2 + len(EXPR) * (box + gap)
    old = [old_canvas(rev, f"portraits/nuri_{e}.png") for e in EXPR]
    new = [Canvas(64, 64).draw(PORTRAITS[f"nuri_{e}"][0]) for e in EXPR]
    H = pad + 2 * (18 + box + 16) + 18 + box + 40 + pad
    cv = Canvas(W, H, BG)
    y = pad
    for label, row in ((f"before ({rev})  64x64 x3", old), ("after (cozy)  64x64 x3", new)):
        text(cv, label, pad, y, 2, HEAD)
        y += 18
        for i, p in enumerate(row):
            x0 = pad + i * (box + gap)
            cv.fill_rect(x0 - 2, y - 2, box + 4, box + 4, PANEL)
            cv.paste(p, x0, y, S)
            text(cv, EXPR[i], x0, y + box + 4, 1, DIM)
        y += box + 16
    text(cv, "in game: dialogue x3 / battle-lesson x2 / walk sheet x8", pad, y, 2, HEAD)
    y += 18
    x = pad + 3
    framed(cv, new[0], x, y + 3, 3)
    x += box + 6 + gap
    for p in (new[1], new[3]):
        framed(cv, p, x, y + 3, 2)
        x += 128 + 6 + gap
    frames = CHARACTERS["nuri"]
    for k in (0, 5):                       # 아래 보기 서기, 깜빡임
        f = Canvas(16, 24).draw(frames[k])
        cv.fill_rect(x - 2, y + 1, 16 * 8 + 4, 24 * 8 + 4, PANEL)
        cv.paste(f, x, y + 3, 8)
        x += 16 * 8 + gap
    with open(OUT, "wb") as fh:
        fh.write(encode_png(cv.width, cv.height, cv.rows()))
    print(os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
