# P0714 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 세 경우 모두 Q = 200,000(같은 크기, 입력 2줄)이라서 phases[2].stopOnTle을 쓸 수 있다. 수는 0 이상 1,000,000 이하.
# 수의 대부분을 큰 소수와 '두 소수의 곱(두 소수 모두 500 이상)'으로 채워서, 수마다 나눠 보는 판정이
# 거의 √M(약 1000)번씩 끝까지 돌게 한다. 서로 다른 값도 많아서(wide 67,174개, dense 36,806개, mixed 53,790개)
# 판정 결과를 dict에 기억해 두는 풀이도 크게 빨라지지 않는다(Pyodide 측정: wide에서 제한의 약 1.8배 이상, 2026-10-19).
Q = 200000
M = 1000000


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def sieve(m):
    is_prime = bytearray([1]) * (m + 1)
    is_prime[0] = 0
    is_prime[1] = 0
    i = 2
    while i * i <= m:
        if is_prime[i]:
            is_prime[i * i::i] = bytes(len(range(i * i, m + 1, i)))
        i += 1
    return is_prime


IS_PRIME = sieve(M)


def primes_between(lo, hi):
    return [v for v in range(lo, hi + 1) if IS_PRIME[v]]


def semiprimes():
    """p ≤ q인 두 소수(모두 500 이상)의 곱 가운데 M 이하. 제곱수 p × p도 들어 있다"""
    small = primes_between(500, 1000)
    big = primes_between(500, M // 500)
    return [p * q for p in small for q in big if q >= p and p * q <= M]


def shuffle(nxt, a):
    for i in range(len(a) - 1, 0, -1):
        j = nxt(i + 1)
        a[i], a[j] = a[j], a[i]


def build(case):
    if case == "wide":
        # 서로 다른 값이 가장 많은 경우: 20만 이상의 소수 전부(약 6만 개)와 두 소수의 곱 전부를 한 번씩 넣고
        # 나머지는 그 가운데서 고른다(서로 다른 값 67,174개). 가장 큰 수는 999997 = 757 × 1321
        nxt = make(20261019)
        pool = primes_between(200000, M) + semiprimes()
        nums = pool + [pool[nxt(len(pool))] for _ in range(Q - len(pool))]
    elif case == "dense":
        # 50만 이상의 큰 소수(약 3만 7천 개)만 골라 넣는다. 수마다 나눠 보면 거의 1000번씩 돈다
        nxt = make(714)
        pool = primes_between(500000, M)
        nums = [999983] + [pool[nxt(len(pool))] for _ in range(Q - 1)]
    else:
        # mixed: 큰 소수 60%, 두 소수의 곱 40%에 경계값(0, 1, 2, 4, 1,000,000)을 조금 섞는다.
        # 가장 큰 수는 1,000,000(합성수)이라 체의 크기가 1,000,001이어야 한다
        nxt = make(1714)
        big = primes_between(300000, M)
        semi = semiprimes()
        edge = [0, 1, 2, 4, M] * 4
        rest = Q - len(edge)
        nums = edge + [big[nxt(len(big))] for _ in range(rest * 3 // 5)]
        nums += [semi[nxt(len(semi))] for _ in range(Q - len(nums))]
    shuffle(nxt, nums)
    return nums


def solve(nums):
    count = 0
    total = 0
    for v in nums:
        if IS_PRIME[v]:
            count += 1
            total += v
    return count, total


def generate(case):
    nums = build(case)
    count, total = solve(nums)
    return f"{len(nums)}\n{' '.join(map(str, nums))}\n", f"{count}\n{total}\n"
