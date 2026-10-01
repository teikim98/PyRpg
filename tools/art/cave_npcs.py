"""지역 3 NPC 걷기 시트(16×16 × 8프레임: 아래×2, 왼쪽×2, 오른쪽×2, 위×2).

- npc_goblin: 말이 통하는 고블린 서기. 둥근 쇠테 안경(청록 반사), 옆으로 뻗은 큰 귀, 크림색 셔츠 깃에
  남색 조끼, 옆모습에서는 장부(갈색 책)를 끼고 있다.

characters.py의 character()로 다리를 끼워 8프레임을 만들고, 외곽선 K는 닿은 재질의 색 외곽선으로 바꾼다.
"""
from cavepal import CH, color_outline, paint
from characters import character

KEY = {"3": "n3", "4": "n4", "5": "n5", "2": "n2", "M": "m2", "l": "i4", "E": "eye", "k": "r0",
       "w": "b3", "W": "b2", "q": "q1", "Q": "q2", "n": "w3", "N": "w4"}


def _sym(half: str) -> str:
    rows = [r.strip() for r in half.strip("\n").splitlines() if r.strip()]
    return "\n".join(r + r[::-1] for r in rows)


DOWN = paint(_sym("""
    ........
    ....KKKK
    ...K4555
    KK.K4555
    K4K45555
    .K344555
    ..K34MM4
    ..K3MlEM
    ..K34MM4
    ...K3344
    ....K3kk
    ...KwqqW
    ..K4QqqW
    ..KKqqqq
"""), KEY, 16, 14)

RIGHT = paint("""
    ................
    ....KKKKK.......
    ...K455555K.....
    KK.K4555555K....
    K4K455555555K...
    .K334455555554K.
    ..K33454MMM5K...
    ..K33454MlEM44K.
    ..K334454MM444K.
    ...K3344444k4K..
    ....KK3333KK....
    ...KwqqqWnNK....
    ...KqqqQnnNK....
    ....KqqqKKK.....
""", KEY, 16, 14)

UP = paint(_sym("""
    ........
    ....KKKK
    ...K4555
    KK.K4555
    K4K45555
    .K344555
    ..K34455
    ..KM3444
    ..K33344
    ...K3333
    ....KK33
    ...KqqqQ
    ..K4qqqQ
    ..KKqqqq
"""), KEY, 16, 14)

CAVE_CHARACTERS = {
    "npc_goblin": [color_outline(f) for f in character(DOWN, RIGHT, UP, CH["q0"], CH["w1"])],
}
