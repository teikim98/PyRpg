# P0704 숨김 테스트의 큰 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 세 경우 모두 길이 N = 200,000이다. 반복 안에서 s[:j].count("A")를 하면 O(N²)이라 timeLimitMs 안에 끝나지 않는다.
N = 200000


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def build(case):
    if case == "sorted":
        # A가 모두 앞, B가 모두 뒤: 짝이 가장 많다(10^5 × 10^5 = 10^10)
        return "A" * (N // 2) + "B" * (N // 2)
    if case == "alt":
        # ABAB...: B마다 앞의 A 수가 1씩 늘어난다
        return "AB" * (N // 2)
    # random: A와 B가 반반쯤 섞임
    nxt = make(20261019)
    return "".join("AB"[nxt(2)] for _ in range(N))


def solve(s):
    a_seen = 0
    pairs = 0
    for ch in s:
        if ch == "A":
            a_seen += 1
        else:
            pairs += a_seen
    return pairs


def generate(case):
    s = build(case)
    return s + "\n", str(solve(s)) + "\n"
