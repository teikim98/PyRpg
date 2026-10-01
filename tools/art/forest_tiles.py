"""지역 2(갈림길 숲) 지형 타일(16×16). manifest의 overworld 타일셋 끝에 이 순서대로 붙는다.

바닥류(forest_floor, fallen_leaves, tall_grass, root_floor, stream, stepping_stone)는 가장자리가 이어지게
그린다. 물체류(stump, log, mushroom_patch, signpost_fork, pine_tree, moss_stone)는 숲 바닥을 깔고
그 위에 색 외곽선을 두른 물체를 얹는다. 시간이 멈춘 숲이라 낙엽이 공중에 떠 있고(그림자가 아래에 따로),
물은 청록 얼음으로 굳어 있다.
"""
from forestpal import color_outline, paint
from gridlib import overlay

FLOOR_KEY = {"0": "f0", "1": "f1", "2": "f2", "3": "f3", "4": "f4", "5": "f5", "6": "f6", "t": "i4"}

FOREST_FLOOR = paint("""
    3333333333333333
    3333333353333333
    3333333242333333
    3322333333333333
    3222233333333333
    3322333333332233
    3333333333322223
    3333353333332233
    3333242333333333
    3333333333333333
    3333333333335333
    3t33333333324233
    3333332233333333
    3333322223333333
    3333332233333533
    3333333333332423
""", FLOOR_KEY, 16, 16)


def on_floor(text: str, legend: dict, base=None, outline: bool = True):
    """숲 바닥 위에 물체를 얹는다. 물체는 색 외곽선을 두른 뒤 겹친다. '_'는 외곽선 없이 바닥에 직접 칠하는 그림자."""
    shadow_key = {"_": "f1", "-": "f0"}
    obj_rows = []
    shadow_rows = []
    for line in [r.strip() for r in text.strip("\n").splitlines() if r.strip()]:
        obj_rows.append("".join("." if ch in shadow_key else ch for ch in line))
        shadow_rows.append("".join(ch if ch in shadow_key else "." for ch in line))
    obj = paint("\n".join(obj_rows), legend, 16, 16)
    if outline:
        obj = color_outline(obj)
    shadow = paint("\n".join(shadow_rows), shadow_key, 16, 16)
    return overlay(overlay(base or FOREST_FLOOR, shadow), obj)


LEAF_KEY = {"a": "a1", "b": "a2", "c": "a3", "d": "a4", "r": "a0", "t": "i4", "T": "i5"}

# 바닥에 깔린 낙엽 + 공중에 멈춘 낙엽 두 장(아래에 그림자, 둘레에 청록 반짝임)
FALLEN_LEAVES = on_floor("""
    ................
    ...........t....
    ..bc......tcdT..
    .bcr.......bc...
    ..r.............
    ...........__...
    ......cd........
    .....bcr........
    .....r..........
    .t........ab....
    tdc......abr....
    .bb.......r.....
    ................
    .__.....dc......
    ........bcb.....
    .........r......
""", LEAF_KEY, outline=False)

GRASS_KEY = {"1": "f1", "2": "f2", "4": "f4", "5": "f5", "6": "f6", "0": "f0"}

TALL_GRASS = on_floor("""
    ................
    ..6.........6...
    ..5...6.....5..6
    .45..5.....45..5
    .4..45.6...4..45
    .4.4.45.5..4.44.
    2424.4.45.24.4..
    2424244.4.24242.
    02424242422424..
    0024242424224242
    .00222222200222.
    ...0000000.000..
    ................
    ................
    ................
    ................
""", GRASS_KEY, outline=False)

ROOT_KEY = {"0": "e0", "1": "e1", "2": "e2", "3": "e3", "4": "e4", "b": "w1", "c": "w2", "d": "w3"}

# 뿌리 바닥: 다져진 흙 위로 굵은 뿌리가 가로질러(y=5~7, 옆 칸과 이어짐) 아래로 한 갈래 갈라진다.
ROOT_FLOOR = paint("""
    2222322222222222
    2322222232222322
    2222222222222222
    2223222222222222
    3333222222223333
    bccd3333333cbccd
    1bbccccccccbb1bb
    2211bbbbbbb11222
    2222111111bc2222
    2232222222bc3222
    22222222222bc222
    232222222222bc22
    2222222222222b12
    1222222322222212
    2222222222222222
    2223222222232222
""", ROOT_KEY, 16, 16)

ICE_KEY = {"0": "i0", "1": "i1", "2": "i2", "3": "i3", "4": "i4", "5": "i5", "w": "white"}

# 멈춘 개울: 물결이 그대로 얼어붙은 청록 얼음. 가로로 흐르던 결과 금, 반짝임
STREAM = paint("""
    2222222222222222
    2223333222222222
    2233222332222222
    2222222223322222
    1122222222211111
    2222222222222222
    2222222245222222
    2222222452222222
    2222224522222222
    2222222222222233
    3332222222223332
    2223333222333222
    2222222333222222
    1122222222222211
    2225222222222222
    2222222222225222
""", ICE_KEY, 16, 16)

STONE_KEY = {"0": "s0", "1": "s1", "2": "s2", "3": "s3", "4": "s4", "5": "s5",
             "m": "f3", "M": "f4", "L": "f5", "t": "i4", "T": "i5", "_": "i1"}

STEPPING_STONE = overlay(STREAM, color_outline(paint("""
    ................
    ................
    ................
    .....tttttt.....
    ...tt344443tt...
    ..t3455MMM443t..
    ..t45MMLLM4432t.
    .t345MMMM44332t.
    .t344444443322t.
    .t233333333221t.
    ..t12222222110t.
    ..._11111110_t..
    ....__000000_...
    ................
    ................
    ................
""", STONE_KEY, 16, 16)))

BARK_KEY = {"a": "w0", "b": "w1", "c": "w2", "d": "w3", "e": "w4", "f": "w5",
            "m": "f3", "M": "f4", "L": "f5", "t": "i3", "T": "i4", "r": "a2"}

STUMP = on_floor("""
    ................
    ................
    ................
    ....eeeeeeee....
    ..eeffffffffee..
    .effeeeeeeeeffe.
    .efeffffffffefd.
    .efefeeeeeefefd.
    .deffeeTTeeffed.
    .bdeeffttffeedb.
    .bcdddeeeedddcb.
    .bccddMdddccMcb.
    .bbccLMddccLMbb.
    .bcbbccdccbbccb.
    .__abb.bccb.ba_.
    ..____.____.__..
""", BARK_KEY)

LOG = on_floor("""
    ................
    ................
    ................
    ................
    .....MMLLMM.ML..
    ..ee.ccccddddLM.
    .effeccddddeeeM.
    eeTfeccdddeeeec.
    effteccccddddcc.
    .efeebbccccccbb.
    ..eebbbbbbbbbba.
    ...._bbbaabbba_.
    ...___________..
    ................
    ................
    ................
""", BARK_KEY)

MUSH_KEY = {"a": "m1", "b": "m2", "c": "m3", "d": "m4", "w": "c3", "s": "c1", "S": "c2",
            "t": "i2", "T": "i3", "u": "i4", "U": "i5", "M": "f4", "L": "f5"}

# 버섯 무리: 빨간 갓 둘과 시간이 멈춰 청록으로 빛나는 작은 버섯 하나
MUSHROOM_PATCH = on_floor("""
    ................
    ................
    ................
    ..........uU....
    ...bbb...uTTu...
    ..bcwcb..TTtT...
    .bcbbbbb..sS....
    .abbwbba..sS....
    ...sSS...._.....
    ...sSS..........
    ...___...cbc....
    .........bwbb...
    ..........sS....
    ...........___..
    ................
    ................
""", MUSH_KEY)

SIGN_KEY = {"a": "w0", "b": "w1", "c": "w2", "d": "w3", "e": "w4", "f": "w5", "t": "i3", "T": "i4", "x": "a1"}

# 갈림길 이정표: 기둥 하나에 서로 다른 쪽을 가리키는 화살표 판 세 장
SIGNPOST_FORK = on_floor("""
    ................
    .......cd.......
    .deeeeeeeeeeb...
    deffcfcffcffb...
    .dcccccccccca...
    .......cd.......
    ...beeeeeeeeeed.
    ...bffcffcfcffee
    ...accccccccccd.
    .......cd.......
    .......cd.......
    .......cd.......
    .......cd.......
    ......bcdb......
    ......acdb......
    .....______.....
""", SIGN_KEY)

PINE_KEY = {"0": "p0", "1": "p1", "2": "p2", "3": "p3", "4": "p4", "5": "p5",
            "a": "w0", "b": "w1", "c": "w2", "d": "w3", "t": "i4", "T": "i5", "o": "a3", "O": "a4"}

# 전나무: 층층이 쌓인 가지, 왼쪽 위에서 빛. 가지 끝에 서리(청록)가 얼어붙어 있다
PINE_TREE = on_floor("""
    .......4........
    ......453.......
    .....45332......
    ....t453321.....
    ......4332......
    ....4553322.....
    ..t45533322T....
    ....44333221....
    ...4553333221...
    .t455333332221..
    .44433333222211.
    ..1111111111111T
    ......acdb......
    ......acdb......
    ...___acdb___...
    ......____......
""", PINE_KEY)

MOSS_KEY = {"0": "s0", "1": "s1", "2": "s2", "3": "s3", "4": "s4", "5": "s5",
            "m": "f3", "M": "f4", "L": "f5", "N": "f6", "t": "i3", "T": "i4"}

# 이끼 바위: 둥근 바위 위에 이끼 모자, 틈에 청록 서리
MOSS_STONE = on_floor("""
    ................
    ................
    ................
    ......MMLLM.....
    ....MLLNNLMMm...
    ...MLNLLLMMMmm..
    ..m4MLLMMMm3m2..
    ..454mMmm3332...
    .3454433332221..
    .34443333T22211.
    .3443332Tt22211.
    .2333322t221110.
    .1222222221110..
    ..1111111110....
    .__000000000__..
    ...__________...
""", MOSS_KEY)

FOREST_TILES = {
    "forest_floor": FOREST_FLOOR,
    "fallen_leaves": FALLEN_LEAVES,
    "tall_grass": TALL_GRASS,
    "stump": STUMP,
    "log": LOG,
    "mushroom_patch": MUSHROOM_PATCH,
    "stream": STREAM,
    "stepping_stone": STEPPING_STONE,
    "signpost_fork": SIGNPOST_FORK,
    "pine_tree": PINE_TREE,
    "moss_stone": MOSS_STONE,
    "root_floor": ROOT_FLOOR,
}
