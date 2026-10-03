# P0608 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 세 경우 모두 N = 100,000(같은 크기)이라서 phases[2].stopOnTle을 쓸 수 있다.
# 이름은 자음+모음 음절 2~4개(4~8글자, 서로 다름)라 기대 출력은 70만 자 안팎(출력 상한 1 MiB 미만)이다.
N = 100000
CONS = "bdgklmnprstv"
VOWS = "aeiou"


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def names(nxt, k):
    """서로 다른 이름 k개(나온 순서 그대로라 사전순이 아니다)"""
    out = []
    seen = set()
    while len(out) < k:
        w = "".join(CONS[nxt(12)] + VOWS[nxt(5)] for _ in range(2 + nxt(3)))
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out


def build(case):
    """[(이름, 노 젓기, 헤엄, 잠수)] N명"""
    if case == "random":
        # 기록이 0~100으로 넓게 퍼짐. 세 기록이 모두 같은 사람도 가끔 있다
        nxt = make(20261003)
        return [(w, nxt(101), nxt(101), nxt(101)) for w in names(nxt, N)]
    if case == "tie":
        # 기록이 1~3뿐이라 동률이 아주 많다(27묶음에 약 3700명씩). 묶음 안의 순서는 이름이 정한다
        nxt = make(606)
        return [(w, 1 + nxt(3), 1 + nxt(3), 1 + nxt(3)) for w in names(nxt, N)]
    # mirror: 노 젓기 점수가 모두 같고(경계: 첫째 기록 전부 동률), 헤엄은 오름차순, 잠수는 내림차순이 서로 엇갈린다
    nxt = make(808)
    rows = []
    for w in names(nxt, N):
        b = nxt(101)
        rows.append((w, 50, b, (b * 7 + nxt(5)) % 101))
    return rows


def solve(rows):
    return [r[0] for r in sorted(rows, key=lambda r: (-r[1], r[2], -r[3], r[0]))]


def generate(case):
    rows = build(case)
    lines = [str(len(rows))] + [f"{w} {a} {b} {c}" for w, a, b, c in rows]
    return "\n".join(lines) + "\n", "\n".join(solve(rows)) + "\n"
