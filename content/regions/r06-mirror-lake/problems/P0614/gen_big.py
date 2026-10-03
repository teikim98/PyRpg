# P0614 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 세 경우 모두 Q = 100(같은 크기)이라서 phases[2].stopOnTle을 쓸 수 있다. n은 10^15 ~ 10^18.
Q = 100
LO = 10 ** 15
HI = 10 ** 18


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def big(nxt):
    """LO 이상 HI 이하의 큰 수(작은 난수 셋을 이어 붙인다)"""
    v = nxt(1000000) * 10 ** 12 + nxt(1000000) * 10 ** 6 + nxt(1000000)
    return LO + v % (HI - LO + 1)


def build(case):
    if case == "random":
        # 10^15 ~ 10^18에 고르게 흩어진 세기
        nxt = make(20261003)
        return [big(nxt) for _ in range(Q)]
    if case == "edge":
        # 경계: 가장 작은 세기와 가장 큰 세기, 2와 3의 거듭제곱 근처, 같은 질문 반복
        nxt = make(1018)
        fixed = [LO, HI, HI - 1, LO + 1, 2 ** 59, 2 ** 59 - 1, 3 ** 37, 3 ** 37 + 1, 2 ** 30 * 3 ** 18, HI]
        qs = fixed + [big(nxt) for _ in range(Q - len(fixed))]
        for i in range(Q - 1, 0, -1):
            j = nxt(i + 1)
            qs[i], qs[j] = qs[j], qs[i]
        return qs
    # near: 가장 큰 세기 근처의 서로 다른 세기 100개(이웃한 세기는 메아리 값이 많이 겹친다)
    return [HI - 3 * k for k in range(Q)]


def solve(qs):
    memo = {0: 1}

    def echo(n):
        if n in memo:
            return memo[n]
        memo[n] = echo(n // 2) + echo(n // 3)
        return memo[n]

    return [echo(n) for n in qs]


def generate(case):
    qs = build(case)
    return (str(len(qs)) + "\n" + "\n".join(map(str, qs)) + "\n",
            "\n".join(map(str, solve(qs))) + "\n")
