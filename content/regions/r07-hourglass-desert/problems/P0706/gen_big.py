# P0706 숨김 테스트의 큰 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 세 경우 모두 N = 200,000이다. 모든 짝을 확인하는 이중 반복은 약 2 × 10^10번이라 timeLimitMs 안에 끝나지 않는다.
N = 200000


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def build(case):
    """(K, 무게 목록)"""
    if case == "dense":
        # 무게 1~999, K = 1000: 짝이 아주 많고 K / 2 = 500인 짐도 여러 개
        nxt = make(706)
        return 1000, [1 + nxt(999) for _ in range(N)]
    if case == "half":
        # 경계: 모든 짐이 K / 2라서 모든 두 짐이 짝(N(N-1)/2)
        return 1000000000, [500000000] * N
    # random: 무게 1~10^9로 넓게 퍼짐. K는 두 짐의 무게 합으로 정해 짝이 적어도 하나
    nxt = make(20261019)
    ws = [1 + nxt(1000000) * 1000 + nxt(1000) for _ in range(N)]
    return ws[nxt(N)] + ws[nxt(N)], ws


def solve(k, ws):
    count = {}
    pairs = 0
    for w in ws:
        pairs += count.get(k - w, 0)
        count[w] = count.get(w, 0) + 1
    return pairs


def generate(case):
    k, ws = build(case)
    return f"{len(ws)} {k}\n" + " ".join(map(str, ws)) + "\n", str(solve(k, ws)) + "\n"
