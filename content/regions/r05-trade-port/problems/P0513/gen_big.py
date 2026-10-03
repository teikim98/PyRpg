# P0513 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 네 경우 모두 N = Q = 100,000(같은 크기)이라서 phases[2].stopOnTle을 쓸 수 있다.
# 화물 이름은 자음+모음 음절 2~3개(4~6글자)라 입력은 1.3 MB 안팎이다.
N = 100000
Q = 100000
CONS = "bdgklmnprstv"
VOWS = "aeiou"


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def vocab(nxt, k):
    """서로 다른 이름 k개. 모두 모음으로 끝난다"""
    out = []
    seen = set()
    while len(out) < k:
        w = "".join(CONS[nxt(12)] + VOWS[nxt(5)] for _ in range(2 + nxt(2)))
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out


def absent(w):
    """장부에 없는 이름: 자음으로 끝나서 vocab의 어떤 이름과도 같지 않다"""
    return w + "x"


def build(case):
    """(화물 목록, 질문 목록)"""
    if case == "random":
        # 종류 3000개, 앞쪽 이름이 더 자주 실린다. 질문의 10%는 없는 이름
        nxt = make(20261003)
        words = vocab(nxt, 3000)
        cargo = [words[min(nxt(3000), nxt(3000))] for _ in range(N)]
        qs = [absent(words[nxt(3000)]) if nxt(10) == 0 else words[nxt(3000)] for _ in range(Q)]
    elif case == "tie":
        # 종류 2000개가 모두 50개씩(전부 동률). 맨 앞 화물은 사전순으로 가장 앞선 이름이 아니다
        nxt = make(5050)
        words = vocab(nxt, 2000)
        cargo = [w for w in words for _ in range(50)]
        for i in range(N - 1, 0, -1):
            j = nxt(i + 1)
            cargo[i], cargo[j] = cargo[j], cargo[i]
        smallest = min(words)
        if cargo[0] == smallest:
            k = cargo.index(max(words))
            cargo[0], cargo[k] = cargo[k], cargo[0]
        qs = [absent(words[nxt(2000)]) if nxt(5) == 0 else words[nxt(2000)] for _ in range(Q)]
    elif case == "missing":
        # 질문의 80%가 장부에 없는 이름
        nxt = make(404)
        words = vocab(nxt, 3000)
        cargo = [words[nxt(3000)] for _ in range(N)]
        qs = [words[nxt(3000)] if nxt(5) == 0 else absent(words[nxt(3000)]) for _ in range(Q)]
    else:
        # few: 종류 30개뿐, 한 이름에 몰림. 질문은 모두 있는 이름
        nxt = make(30)
        words = vocab(nxt, 30)
        cargo = [words[nxt(30) * nxt(2)] for _ in range(N)]
        qs = [words[nxt(30)] for _ in range(Q)]
    return cargo, qs


def solve(cargo, qs):
    count = {}
    for c in cargo:
        count[c] = count.get(c, 0) + 1
    out = [str(count.get(q, 0)) for q in qs]
    top = max(count.values())
    out.append(min([w for w, c in count.items() if c == top]))
    return out


def generate(case):
    cargo, qs = build(case)
    out = solve(cargo, qs)
    return (str(len(cargo)) + "\n" + " ".join(cargo) + "\n" + str(len(qs)) + "\n" + "\n".join(qs) + "\n",
            "\n".join(out) + "\n")
