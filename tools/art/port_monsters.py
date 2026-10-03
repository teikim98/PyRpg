"""지역 5(교역항) 몬스터 5종(16×16 프레임 2개).

몸통은 외곽선 없이 칠한 뒤 color_outline()으로 재질에 맞는 색 외곽선을 두른다(누리의 화풍).
대칭인 몸은 왼쪽 절반(8칸)만 그리고 sym()으로 좌우를 맞춘다. 빛은 왼쪽 위에서 온다.
지역 1~4 몬스터(슬라임 돔, 박쥐, 부엉이, 층층 게 등)와 실루엣이 겹치지 않게:
쌍둥이 물고기는 꼬리가 붙은 채 좌우로 머리를 둔 나비넥타이 모양, 장부 갈매기는 옆모습에 부리에 문 빨간 장부,
구슬 해파리는 반투명한 갓과 늘어진 촉수(속에 색이 다른 구슬 셋), 눈금 앵무새는 옆모습에 긴 꼬리와 날개의 正자 눈금,
줄 게는 옆모습의 소라게(나선 껍데기) 위에 작은 게 셋이 한 줄로 탄 가로로 긴 모양이다.
지역 3 '층층 게'(정면, 빨간 게 위에 상자가 세로로 쌓임)와는 방향(옆모습)·색(산호 주황과 크림색 껍데기)·쌓는 방향(가로 줄)이 다르다.
"""
from gridlib import overlay, shift
from portpal import color_outline, paint, shade_right, sym

# ── 쌍둥이 물고기(tuple): 꼬리지느러미가 하나로 붙은 은빛 물고기 둘이 서로 반대쪽을 본다.
# 프레임 B는 둘이 함께 꼬리를 쳐서 몸이 한 칸 휘고 지느러미가 펄럭인다 ─────────────────────────
FISH_KEY = {"1": "x1", "2": "x2", "3": "x3", "4": "x4", "5": "x5", "e": "eye", "w": "white",
            "o": "o2", "O": "o3", "P": "o4", "b": "b5", "B": "b6"}

_FISH_A = paint(sym("""
    ........
    ........
    ........
    ...P....
    ...OP...
    ..4OOP..
    .45444O.
    45w5443P
    4ee44333
    .4433332
    ..3222O.
    ...2OO..
    ....O...
    ........
    ........
    ........
"""), FISH_KEY, 16, 16)

_FISH_B = paint(sym("""
    ........
    ........
    ........
    ........
    ...P....
    ..POP...
    .4OOOP..
    45444OPP
    5w54433O
    ee444333
    .433332O
    ..2222O.
    ..OO....
    ........
    ........
    ........
"""), FISH_KEY, 16, 16)

_BUBBLES_A = paint("""
    .B..
    B.B.
    .B..
    ...b
""", FISH_KEY, 4, 4)
_BUBBLES_B = paint("""
    ..B.
    .B.B
    ..B.
    b...
""", FISH_KEY, 4, 4)


def _twin_fish(flap: bool):
    g = shade_right(_FISH_B if flap else _FISH_A, 8)
    g = color_outline(g)
    # 입에서 올라가는 공기 방울 두 줄기(왼쪽 물고기는 왼쪽 위, 오른쪽 물고기는 오른쪽 위)
    bub = _BUBBLES_B if flap else _BUBBLES_A
    g = overlay(g, bub, 0, 1 if flap else 2)
    g = overlay(g, [r[::-1] for r in bub], 12, 2 if flap else 1)
    return g


# ── 장부 갈매기(dict): 옆모습(왼쪽을 봄)의 흰 갈매기가 노란 부리에 빨간 장부를 물었다. 회색 날개 끝은 짙고,
# 주황 발. 프레임 B는 날개를 위로 펼친다(장부 쪽지가 살짝 펄럭) ─────────────────────────────
GULL_KEY = {"5": "y5", "4": "y4", "3": "y3", "2": "y2", "1": "y1", "0": "y0", "e": "eye",
            "g": "g3", "G": "g4", "R": "r3", "r": "r2", "x": "r1", "a": "a4", "A": "a5", "o": "o3", "O": "o2"}

_GULL_A = paint("""
    ................
    ................
    ................
    .....455........
    ....45555.......
    ...45e555.......
    .GGg5555........
    RRRx4555........
    RaAx45554333....
    RaAx4555332220..
    RRRx.4553322100.
    .x.x..44433210..
    .......4444.....
    ........o.o.....
    .......OO.OO....
    ................
""", GULL_KEY, 16, 16)

_GULL_B = paint("""
    ..........0.....
    .........120....
    ........1232....
    .....455233.....
    ....45555322....
    ...45e555332....
    .GGg5555.332....
    RRRx4555...2....
    RaAx4555543.....
    RaAx45555433....
    RRRx.455544330..
    .x.x..44433210..
    .......4444.....
    ........o.o.....
    .......OO.OO....
    ................
""", GULL_KEY, 16, 16)


def _ledger_gull(wings_up: bool):
    return color_outline(_GULL_B if wings_up else _GULL_A)


# ── 구슬 해파리(set): 반투명한 분홍 보라 갓 속에 색이 다른 구슬(빨강·초록·금)이 하나씩 떠 있고, 촉수가 늘어진다.
# 프레임 B는 갓이 오므라들며 한 칸 내려앉고 촉수가 반대로 흔들린다 ─────────────────────────────
JELLY_KEY = {"0": "j0", "1": "j1", "2": "j2", "3": "j3", "4": "j4", "5": "j5"}

_JELLY_A = paint(sym("""
    ........
    ........
    .....455
    ...44333
    ..433333
    .4333333
    .3333333
    .3322222
    .2222222
    .1212121
    ..2..2.1
    ..2.2..2
    .2..2.2.
    ..2..2.2
    ..1.1..1
    ........
"""), JELLY_KEY, 16, 16)

_JELLY_B = paint(sym("""
    ........
    ........
    ........
    .....455
    ...44333
    ..433333
    ..333333
    .3333222
    .2222222
    .1212121
    .2..2..1
    ..2..2.2
    ..2.2..2
    .2..2.2.
    .1..1..1
    ........
"""), JELLY_KEY, 16, 16)

MARBLE_KEY = {"R": "r3", "r": "r2", "E": "e4", "e": "e2", "G": "g4", "g": "g2", "w": "white"}
_MARBLES = [(paint("wR\nRr", MARBLE_KEY, 2, 2), 4, 5), (paint("wE\nEe", MARBLE_KEY, 2, 2), 9, 7),
            (paint("wG\nGg", MARBLE_KEY, 2, 2), 10, 3)]


def _bubble_jelly(squash: bool):
    g = shade_right(_JELLY_B if squash else _JELLY_A, 10, skip=("j5", "j4"))
    for m, x, y in _MARBLES:
        g = overlay(g, m, x, y + (1 if squash else 0))
    return color_outline(g)


# ── 눈금 앵무새(Counter): 옆모습(왼쪽을 봄)의 초록 앵무새. 노란 뺨, 굽은 상아빛 부리, 날개에 새긴 正자 눈금
# (세로 넷 + 가로 하나), 빨강·파랑 긴 꼬리. 프레임 B는 부리를 벌리고 날개를 들어 눈금을 내보인다 ──────────
PARROT_KEY = {"5": "e5", "4": "e4", "3": "e3", "2": "e2", "1": "e1", "0": "e0", "e": "eye", "w": "white",
              "Y": "g4", "y": "g3", "b": "a4", "B": "a2", "k": "k1", "R": "r3", "r": "r2", "Q": "q3", "q": "q2",
              "o": "k3", "O": "k4"}

_PARROT_A = paint("""
    ................
    .......45.......
    .....45554......
    ....4555554.....
    ...bbYwe554.....
    ..bbbYYe5543....
    ..bB.YY45443....
    ..B...44433332..
    ......4433222232
    ......433222222.
    ......43322222..
    .......4322221..
    ........OoOo.RQ.
    ..........rRQq..
    ..........rRqq..
    ............Rq..
""", PARROT_KEY, 16, 16)

_PARROT_B = paint("""
    .......45.......
    .....45554......
    ....4555554..22.
    ...bbYwe5542222.
    ..bbbYYe554322..
    ..b..YY4554322..
    ..bB..4544332...
    ..B...44433322..
    ......4433332...
    ......43332222..
    ......4333222...
    .......4332221..
    ........OoOo.RQ.
    ..........rRQq..
    ..........rRqq..
    ............Rq..
""", PARROT_KEY, 16, 16)

# 날개의 正자 눈금(세로 넷, 가로로 긋는 하나)
_TALLY = paint("""
    k.k.k.k
    k.k.k.k
    kkkkkkk
    k.k.k.k
""", PARROT_KEY, 7, 4)


def _tally_parrot(open_beak: bool):
    g = _PARROT_B if open_beak else _PARROT_A
    g = overlay(g, _TALLY, 8, 7 if not open_beak else 6)
    return color_outline(g)


# ── 줄 게(deque): 옆모습(왼쪽을 봄)의 소라게. 크림색 나선 껍데기를 지고 산호빛 집게와 눈자루를 내밀었고,
# 껍데기 위에 작은 빨간 게 셋이 한 줄로 서 있다. 프레임 B는 맨 앞 게가 껍데기 앞으로 뛰어내리고(popleft),
# 뒤의 게들이 한 칸씩 앞으로 다가선다 ──────────────────────────────────────────────
CRAB_KEY = {"5": "o5", "4": "o4", "3": "o3", "2": "o2", "1": "o1", "e": "eye", "w": "white",
            "A": "a5", "a": "a4", "b": "a3", "B": "a2", "c": "a1", "s": "o3", "S": "o2"}

_HERMIT = paint("""
    ................
    ................
    ................
    ................
    ................
    ................
    .......aAAAa....
    ......aAaaaabb..
    .e.e.aSSSSSSab..
    .3.3baSAaaaSabb.
    .434aaSaSSaSabb.
    3443.bSaSaaSabB.
    4433.bSaSSSSbBc.
    .3443.SbbbbbBBc.
    ..2.2..2.2.2cc..
    .2..2.2..2......
""", CRAB_KEY, 16, 16)

TINY_KEY = {"R": "r4", "r": "r3", "x": "r2"}

def _queue_crab(pop: bool):
    g = shade_right(_HERMIT, 11)
    g = color_outline(g)
    # 작은 게: 치켜든 두 집게, 둥근 등딱지, 다리
    tiny = color_outline(paint("""
        .....
        .R.R.
        .rRr.
        .x.x.
        .....
    """, TINY_KEY, 5, 5))
    if pop:
        # 맨 앞 게가 껍데기 앞으로 뛰어내렸고, 나머지 둘이 한 칸씩 앞으로 당겨 섰다
        spots = [(0, 3), (5, 2), (9, 1)]
    else:
        spots = [(3, 2), (7, 1), (11, 2)]
    for x, y in spots:
        g = overlay(g, tiny, x, y)
    return g


PORT_MONSTERS = {
    "monster_twin_fish": [_twin_fish(False), _twin_fish(True)],
    "monster_ledger_gull": [_ledger_gull(False), _ledger_gull(True)],
    "monster_bubble_jelly": [_bubble_jelly(False), _bubble_jelly(True)],
    "monster_tally_parrot": [_tally_parrot(False), _tally_parrot(True)],
    "monster_queue_crab": [_queue_crab(False), _queue_crab(True)],
}

_ = shift  # (다른 지역 모듈과 같은 가져오기 목록 유지)
