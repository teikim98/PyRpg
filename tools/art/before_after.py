"""누리 초상화 화풍 변경 전/후 비교 이미지(docs/phase2/nuri-before-after.png)를 만든다.

    python3 tools/art/before_after.py [기준 커밋]   # 기본: a90d11e(64×64 화풍 변경 전, 48×48)

위 줄: 기준 커밋의 초상화 5종과 걷기 시트(git show로 읽음), 아래 줄: 지금 빌드한 결과.
초상화는 크기가 달라도 같은 화면 크기(한 변 192px)가 되도록 정수배로 키운다(48×4, 64×3).
걷기 시트는 4배. build.py/check.py의 산출물이 아니므로 한 번 만들어 커밋해 두는 문서용 그림이다.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build  # noqa: E402
from gridlib import Canvas  # noqa: E402
from png import encode_png, read_png  # noqa: E402

EXPR = ("neutral", "happy", "worried", "surprised", "serious")
OUT = os.path.join(build.ROOT, "docs", "phase2", "nuri-before-after.png")


def old_canvas(rev, rel):
    data = subprocess.run(["git", "show", f"{rev}:assets/{rel}"], cwd=build.ROOT,
                          check=True, capture_output=True).stdout
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        w, h, rows = read_png(path)
    finally:
        os.unlink(path)
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            c.px[y][x] = tuple(rows[y][x])
    return c


def main():
    rev = sys.argv[1] if len(sys.argv) > 1 else "a90d11e"
    S, pad, BOX = 4, 16, 192
    new = build.render_assets(build.load_manifest())
    rels = [f"portraits/nuri_{e}.png" for e in EXPR]
    W = pad + len(EXPR) * (BOX + 10) + pad
    row_h = BOX + 16 * S + 40
    c = Canvas(W, pad + 2 * (row_h + 20) + pad, build.BG)
    for k, (label, get) in enumerate((("before (" + rev + ")", lambda r: old_canvas(rev, r)),
                                      ("after", lambda r: new[r]))):
        y = pad + k * (row_h + 20)
        x = build.text(c, label, pad, y, 2, build.HEAD)
        y += 18
        for i, rel in enumerate(rels):
            p = get(rel)
            ps = BOX // p.width
            if i == 0:
                build.text(c, f"  {p.width}x{p.height} x{ps}", x, y - 18, 2, build.HEAD)
            x0 = pad + i * (BOX + 10)
            c.fill_rect(x0 - 2, y - 2, BOX + 4, BOX + 4, build.PANEL)
            c.paste(p, x0, y, ps)
        sheet = get("sprites/nuri.png")
        y2 = y + BOX + 10
        for i in range(8):
            fr = Canvas(16, 16)
            for yy in range(16):
                fr.px[yy] = sheet.px[yy][i * 16:(i + 1) * 16]
            x0 = pad + i * (16 * S + 8)
            c.fill_rect(x0 - 2, y2 - 2, 16 * S + 4, 16 * S + 4, build.PANEL)
            c.paste(fr, x0, y2, S)
    with open(OUT, "wb") as f:
        f.write(encode_png(c.width, c.height, c.rows()))
    print(os.path.relpath(OUT, build.ROOT))


if __name__ == "__main__":
    main()
