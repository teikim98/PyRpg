"""지역 4 NPC 걷기 시트(16×16 × 8프레임: 아래×2, 왼쪽×2, 오른쪽×2, 위×2).

- npc_ghost_librarian: 반투명한 유령 사서. 하얗게 센 올림머리, 동그란 금테 안경(청록 반사), 바닥까지 끌리는
  긴 로브(양피지색 깃), 옆모습에서는 낡은 책을 품에 안고 있다. 다리 대신 로브 자락이 물결치며 떠다닌다.
  몸은 반투명 색(h 램프, 알파 185~215)이라 뒤의 바닥이 비친다. 안경과 책은 불투명.

characters.py의 character()에 로브 자락 함수를 끼워 8프레임을 만들고, 외곽선 K는 닿은 재질의 색 외곽선으로 바꾼다.
"""
from characters import character
from librarypal import CH, color_outline, paint, sym

KEY = {"W": "h5", "H": "h4", "h": "h3", "m": "h2", "n": "h1", "N": "h0",
       "G": "g3", "g": "g2", "l": "i4", "E": "eye", "A": "a4", "a": "a3",
       "R": "r3", "r": "r2", "B": "a5"}

DOWN = paint(sym("""
    ........
    ......KK
    .....KWW
    ....KWHW
    ...KWHHH
    ...KhHHH
    ..KhGGGH
    ..KhGEGG
    ..KhGGGH
    ...KhHHH
    ...KNmAa
    ..KnmmmA
    .KnmmmmA
    .KNnmmmm
"""), KEY, 16, 14)

RIGHT = paint("""
    ................
    .......KKK......
    ......KWWWK.....
    ....KKWHWHK.....
    ...KWHHHHHHK....
    ...KhhHHHHHHK...
    ...KhhHHGGGHK...
    ...KhhHHGEGGHK..
    ...KhhHHGGGHK...
    ....KhhHHHHK....
    ....KNnmmAK.....
    ...KnmmRRRrK....
    ..KnmmmRBBrK....
    ..KNnmmRRRrK....
""", KEY, 16, 14)

UP = paint(sym("""
    ........
    ......KK
    .....KWW
    ....KWHW
    ...KWHHH
    ...KhHHH
    ..KhhHHH
    ..KhhhHH
    ..KhhhhH
    ...KhhhH
    ...KNmmm
    ..Knmmmm
    .Knmmmmm
    .KNnmmmm
"""), KEY, 16, 14)


def tail_down(p, f, frame):
    """다리 대신 물결치는 로브 자락(프레임마다 물결이 한 칸 옮겨 간다)."""
    if frame == 0:
        return [f".K{p * 12}K.", f"..{f}{f}.{f}{f}.{f}{f}.{f}{f}..."]
    return [f".K{p * 12}K.", f"...{f}{f}.{f}{f}.{f}{f}.{f}..."]


def tail_side(p, f, frame):
    if frame == 0:
        return [f"..K{p * 9}K...", f"...{f}{f}.{f}{f}.{f}{f}....."]
    return [f"..K{p * 9}K...", f"....{f}.{f}{f}.{f}{f}{f}...."]


LIBRARY_CHARACTERS = {
    "npc_ghost_librarian": [
        color_outline(f) for f in character(DOWN, RIGHT, UP, CH["h1"], CH["h0"], tail_down, tail_side)
    ],
}
