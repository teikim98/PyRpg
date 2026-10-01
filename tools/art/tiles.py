"""지형 타일(16×16). 순서는 assets/manifest.json의 tilesets.overworld.tiles를 따른다.

바닥류(grass, path, plaza_stone, water, wall_stone, floor_*, dark_floor 등)는 가장자리가 이어지게
그린다. 물체류(well, tree, bush, lamp_post, crate, market_stall, flower_bed)는 풀이나 돌 바닥을
배경으로 깔아 한 칸짜리 타일로도 쓸 수 있게 한다.
"""
from gridlib import grid, overlay


def bricks(bw, bh, offset, fill, light, shade, mortar, specks=()):
    """가장자리가 이어지는 벽돌·판석 무늬. bw·bh는 16의 약수, offset은 줄마다 어긋나는 양."""
    rows = []
    for y in range(16):
        band = y // bh
        yy = y % bh
        row = []
        for x in range(16):
            xx = (x + band * offset) % bw
            if yy == bh - 1 or xx == bw - 1:
                ch = mortar
            elif yy == 0 or xx == 0:
                ch = light
            elif yy == bh - 2 or xx == bw - 2:
                ch = shade
            else:
                ch = fill
            row.append(ch)
        rows.append(row)
    for x, y, ch in specks:
        rows[y][x] = ch
    return ["".join(r) for r in rows]


GRASS = grid("""
    EEEEEEEEEEEEEEEE
    EEEEEEEEEEEEEEEE
    EEElEEEEEEEEEEEE
    EEeEeEEEEEEEElEE
    EEEEEEEEEEEEeEeE
    EEEEEEEEEEEEEEEE
    EEEEEEEElEEEEEEE
    EEEEEEEeEeEEEEEE
    EEEEEEEEEEEEEEEE
    EElEEEEEEEEEEEEE
    EeEeEEEEEEEElEEE
    EEEEEEEEEEEeEeEE
    EEEEEEEEEEEEEEEE
    EEEEElEEEEEEEEEE
    EEEEeEeEEEEEEEEE
    EEEEEEEEEEEEEEEE
""", 16, 16)

GRASS_FLOWER = overlay(GRASS, grid("""
    ................
    ................
    ..........W.....
    .........WYW....
    ..........W.....
    ................
    ................
    ...i............
    ..iyi...........
    ...i............
    ................
    ................
    ...........W....
    ..........WYW...
    ...........W....
    ................
"""))

PATH = grid("""
    NNNNNNNNNNNNNNNN
    NNNNNNNNNNNNNmNN
    NNmnNNNNNNNNNNnN
    NNNNNNNNNNNNNNNN
    NNNNNNNNmNNNNNNN
    NNNNNNNNNnNNNNNN
    NnNNNNNNNNNNNNNN
    NNNNNNNNNNNNmmNN
    NNNNNmNNNNNNnnNN
    NNNNNNnNNNNNNNNN
    NNNNNNNNNNNNNNNN
    NNNNNNNNNNNNNNNN
    NNmmNNNNNNNmNNNN
    NNnnNNNNNNNNnNNN
    NNNNNNNNNNNNNNNN
    NNNNNNNNNnNNNNNN
""", 16, 16)

PLAZA_STONE = bricks(8, 8, 4, "H", "W", "G", "g", specks=[(3, 3, "G"), (13, 12, "G"), (10, 4, "W")])

WATER = grid("""
    VVVVVVVVVVVVVVVV
    VVVVVVVVVVVVVVVV
    VVVTTTVVVVVVVVVV
    VVTVVVTVVVVVVcVV
    VVVVVVVVVVVVVVVV
    VVVVVVVVVVVVVVVV
    VVVVVVVVVVTTTVVV
    VVVVVVVVVTVVVTVV
    VVcVVVVVVVVVVVVV
    VVVVVVVVVVVVVVVV
    VVVVTTTVVVVVVVVV
    VVVTVVVTVVVVVVVV
    VVVVVVVVVVVVVcVV
    VVVVVVVVVVVVVVVV
    VVVVVVVVVVVVVVVV
    VVVVVVVVVVVVVVVV
""", 16, 16)

# 우물: 물기둥이 솟다가 멈춘 채 공중에 떠 있다(시간 정지).
WELL = overlay(GRASS, grid("""
    .......c........
    ....c..T..c.....
    ......cTc.......
    ..c..cTcTc..c...
    .....KKTTKK.....
    ...KKHHTcHHKK...
    ..KHHGtTTtGHHK..
    ..KHGtTcTTtGHK..
    ..KGHtttttHHGK..
    ..KHHHGGGGHHHK..
    ..KGHHGGHHGGHK..
    ..KgGGHGGGHGgK..
    ..KgHGGgHGGGgK..
    ..KggGgggGgggK..
    ...KKKKKKKKKK...
    ...eeeeeeeeee...
"""))

TREE = overlay(GRASS, grid("""
    .....dddddd.....
    ...ddeeEEeeddd..
    ..deeEElEEeeedd.
    .deeEllEEeeEeed.
    .deEElEEeeEEeed.
    deeEEEeeeEElEeed
    deeeEeeeeeEEeeed
    deeeeeeEEeeeeedd
    .deeeeEEleeeedd.
    .ddeeeeeeeeeddd.
    ..dddeeeedddd...
    ....dddbBdd.....
    ......bBnb......
    ......bBnb......
    .....bBBnBb.....
    ....eebbbbee....
"""))

BUSH = overlay(GRASS, grid("""
    ................
    ................
    ................
    ................
    .....dddddd.....
    ...ddeeEEeedd...
    ..deeEEllEEeed..
    .deeEElEEEEEeed.
    .deEEEEeeEEleed.
    deeEEeeeeeEEeeed
    deeeeeeEEeeeeeed
    deeeeEEleeeeeedd
    .ddeeeeeeeeeedd.
    ..dddddddddddd..
    ...eeeeeeeeee...
    ................
"""))

HOUSE_WALL = grid("""
    nBmmmmmmmmmmmmmm
    nBmmmmmmmmmmNmmm
    nBmmmmmmmmmmmmmm
    nBmmmNmmmmmmmmmm
    nBmmmmmmmmmmmmmm
    nBmmmmmmmmmmmmmm
    nBmmmmmmmmmNmmmm
    nBmmmmmmmmmmmmmm
    nBmmNmmmmmmmmmmm
    nBmmmmmmmmmmmmmm
    nBmmmmmmmmmmmmNm
    nBmmmmmmNmmmmmmm
    nBmmmmmmmmmmmmmm
    nBNNNNNNNNNNNNNN
    nnnnnnnnnnnnnnnn
    BBBBBBBBBBBBBBBB
""", 16, 16)

HOUSE_ROOF = grid("""
    RRRRrRRRRRRRrRRR
    rrrrXrrrrrrrXrrr
    rrrrXrrrrrrrXrrr
    XXXXXXXXXXXXXXXX
    RRRRRRRRrRRRRRRR
    rrrrrrrrXrrrrrrr
    rrrrrrrrXrrrrrrr
    XXXXXXXXXXXXXXXX
    RRRRrRRRRRRRrRRR
    rrrrXrrrrrrrXrrr
    rrrrXrrrrrrrXrrr
    XXXXXXXXXXXXXXXX
    RRRRRRRRrRRRRRRR
    rrrrrrrrXrrrrrrr
    rrrrrrrrXrrrrrrr
    XXXXXXXXXXXXXXXX
""", 16, 16)

HOUSE_DOOR = overlay(HOUSE_WALL, grid("""
    ................
    ................
    .....KKKKKK.....
    ....KbBBBBbK....
    ...KbBnBBnBbK...
    ...KBBnBBnBBK...
    ...KBBnBBnBBK...
    ...KBBnBBnBBK...
    ...KBBnBBnBBK...
    ...KBBnBBnUYK...
    ...KBBnBBnUuK...
    ...KBBnBBnBBK...
    ...KBBnBBnBBK...
    ...KbBnBBnBbK...
    ..KHHHHHHHHHHK..
    ..KGGGGGGGGGGK..
"""))

HOUSE_WINDOW = overlay(HOUSE_WALL, grid("""
    ................
    ................
    ....bbbbbbbb....
    ...bnnnnnnnnb...
    ...bnVcVnVVnb...
    ...bnccVnVVnb...
    ...bnVVVnVVnb...
    ...bnnnnnnnnb...
    ...bnVVVnVcnb...
    ...bnVVVnccnb...
    ...bnnnnnnnnb...
    ..bBBBBBBBBBBb..
    ..bxiexeeixexb..
    ..bnnnnnnnnnnb..
    ...bbbbbbbbbb...
    ................
"""))

FENCE = overlay(GRASS, grid("""
    ................
    ................
    ................
    ...Kn......Kn...
    ..KnNK....KnNK..
    ..KnBK....KnBK..
    KKKnBKKKKKKnBKKK
    nNNnBNNNNNNnBNNN
    BBBnBBBBBBBnBBBB
    KKKnBKKKKKKnBKKK
    ..KnBK....KnBK..
    ..KnBK....KnBK..
    ..KnBK....KnBK..
    ..KnBK....KnBK..
    ..KKKK....KKKK..
    ..eeee....eeee..
"""))

WALL_STONE = bricks(8, 4, 4, "G", "H", "g", "k", specks=[(5, 1, "g"), (12, 9, "H")])

FLOOR_WOOD = grid("""
    nnnnnnnnnNnnnnnn
    nNnnnnnnnnnnnnnn
    nnnnnnBnnnnnnnnn
    BBBBBBBBBBBBBBBB
    nnnnnnnnnnnnBnnn
    nnnnnNnnnnnnBnnn
    nnnnnnnnnnnnBnNn
    BBBBBBBBBBBBBBBB
    nnnBnnnnnnnnnnnn
    nnnBnnnnnnnNnnnn
    nNnBnnnnnnnnnnnn
    BBBBBBBBBBBBBBBB
    nnnnnnnnnnBnnnnn
    nnnnnnnNnnBnnnnn
    nnnnnnnnnnBnnnnn
    BBBBBBBBBBBBBBBB
""", 16, 16)

FLOOR_STONE = bricks(8, 8, 0, "G", "H", "g", "g", specks=[(4, 3, "g"), (5, 4, "g"), (11, 12, "H")])

STAIRS = grid("""
    HHHHHHHHHHHHHHHH
    HGGGGGGGGGGGGGGH
    GGGGGGGGGGGGGGGG
    gggggggggggggggg
    kkkkkkkkkkkkkkkk
    HHHHHHHHHHHHHHHH
    HGGGGGGGGGGGGGGH
    GGGGGGGGGGGGGGGG
    gggggggggggggggg
    kkkkkkkkkkkkkkkk
    HHHHHHHHHHHHHHHH
    HGGGGGGGGGGGGGGH
    GGGGGGGGGGGGGGGG
    gggggggggggggggg
    kkkkkkkkkkkkkkkk
    HHHHHHHHHHHHHHHH
""", 16, 16)

CLOCKTOWER_WALL = bricks(8, 4, 4, "g", "G", "k", "K", specks=[(3, 5, "t"), (11, 13, "t"), (12, 13, "T")])

CLOCKTOWER_DOOR = overlay(CLOCKTOWER_WALL, grid("""
    ......KKKK......
    ....KKUYYUKK....
    ...KUuKtTKuUK...
    ..KbBKKcTKKBbK..
    ..KbBBBKKBBBbK..
    ..KUUUUUUUUUUK..
    ..KbBnBBBBnBbK..
    ..KbBnBBBBnBbK..
    ..KbBnBBBBnBbK..
    ..KUUUUUUUUUUK..
    ..KbBnBBBBnBbK..
    ..KbBnBTcBnBbK..
    ..KbBnBttBnBbK..
    ..KbBnBBBBnBbK..
    ..KUUUUUUUUUUK..
    ..KkkkkkkkkkkK..
"""))

LAMP_POST = overlay(PLAZA_STONE, grid("""
    ......KKKK......
    .....KkkkkK.....
    ....KKKKKKKK....
    ....KYYyYYYK....
    ....KYWYYyYK....
    ....KyYYYYyK....
    ....KKKKKKKK....
    ......KkkK......
    ......KkgK......
    ......KkgK......
    ......KkgK......
    ......KkgK......
    ......KkgK......
    .....KKkgKK.....
    ....KkkkggkK....
    ....KKKKKKKK....
"""))

CRATE = overlay(PLAZA_STONE, grid("""
    ................
    ................
    .KKKKKKKKKKKKKK.
    .KNNNNNNNNNNNNK.
    .KnBBBBBBBBBBnK.
    .KnBnnnnnnnBBnK.
    .KnnBnnnnnBnBnK.
    .KnnnBnnnBnnBnK.
    .KnnnnBnBnnnBnK.
    .KnnnnnBnnnnBnK.
    .KnnnnBnBnnnBnK.
    .KnnnBnnnBnnBnK.
    .KnBBBBBBBBBBnK.
    .KBBBBBBBBBBBBK.
    .KKKKKKKKKKKKKK.
    ..gggggggggggg..
"""))

MARKET_STALL = overlay(PLAZA_STONE, grid("""
    KKKKKKKKKKKKKKKK
    KRRWWRRWWRRWWRRK
    KRRWWRRWWRRWWRRK
    KrrmmrrmmrrmmrrK
    KRRWWRRWWRRWWRRK
    .KrKmKrKmKrKmKK.
    ..Kb........bK..
    ..Kb........bK..
    ..Kb.KxKKNNKbK..
    ..KbKxxKKNNNKK..
    .KKKKKKKKKKKKKK.
    .KNNNNNNNNNNNNK.
    .KnnnnnnnnnnnnK.
    .KnBnnBnnBnnBnK.
    .KBBBBBBBBBBBBK.
    .KKKKKKKKKKKKKK.
"""))

FLOWER_BED = overlay(GRASS, grid("""
    ................
    ................
    ................
    ...x.....y......
    ..xYx...yYy..i..
    ...xe.i..ye.iYi.
    .W..eiYi.e...ie.
    WYW.e.ie.e..e.e.
    KWKKKKKKKKKKKKKK
    KnNNNNNNNNNNNNnK
    KnbbbbbbbbbbbbnK
    KBBBBBBBBBBBBBBK
    KKKKKKKKKKKKKKKK
    .eeeeeeeeeeeeee.
    ................
    ................
"""))

DARK_FLOOR = bricks(8, 8, 4, "k", "g", "k", "K", specks=[(2, 2, "K"), (13, 11, "p"), (9, 5, "K")])

TILES = {
    "grass": GRASS,
    "grass_flower": GRASS_FLOWER,
    "path": PATH,
    "plaza_stone": PLAZA_STONE,
    "water": WATER,
    "well": WELL,
    "tree": TREE,
    "bush": BUSH,
    "house_wall": HOUSE_WALL,
    "house_roof": HOUSE_ROOF,
    "house_door": HOUSE_DOOR,
    "house_window": HOUSE_WINDOW,
    "fence": FENCE,
    "wall_stone": WALL_STONE,
    "floor_wood": FLOOR_WOOD,
    "floor_stone": FLOOR_STONE,
    "stairs": STAIRS,
    "clocktower_wall": CLOCKTOWER_WALL,
    "clocktower_door": CLOCKTOWER_DOOR,
    "lamp_post": LAMP_POST,
    "crate": CRATE,
    "market_stall": MARKET_STALL,
    "flower_bed": FLOWER_BED,
    "dark_floor": DARK_FLOOR,
}
