# P0707 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 세 경우 모두 N = Q = 200,000(같은 크기)이라서 phases[2].stopOnTle을 쓸 수 있다.
# 이름은 영어 소문자 4~8글자, 기대 출력은 200,000줄의 0/1(약 0.4 MB, 출력 상한 1 MiB 미만)이다.
# 모든 경우에 첫 질문은 명부의 마지막 이름(명부에 한 번만 있음)이라 명부를 한 칸 덜 읽는 풀이가 틀린다.
N = 200000
Q = 200000
LETTERS = "abcdefghijklmnopqrstuvwxyz"
# 두 글자 조각 676개. 난수 하나로 두 조각(네 글자)을 골라 생성 시간을 줄인다(게임은 채점 전에 워커에서 생성한다)
PAIRS = [a + b for a in LETTERS for b in LETTERS]


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def word(nxt):
    """영어 소문자 4~8글자"""
    r = nxt(8388608)
    s = nxt(8388608)
    tail = PAIRS[s % 676] + PAIRS[s // 676 % 676]
    return PAIRS[r % 676] + PAIRS[r // 676 % 676] + tail[:s // 456976 % 5]


def fresh(nxt, k, taken):
    """taken에 없는 서로 다른 이름 k개(나온 순서 그대로). 만든 이름은 taken에 더한다"""
    out = []
    while len(out) < k:
        w = word(nxt)
        if w not in taken:
            taken.add(w)
            out.append(w)
    return out


def shuffle(nxt, a):
    for i in range(len(a) - 1, 0, -1):
        j = nxt(i + 1)
        a[i], a[j] = a[j], a[i]


def build(case):
    """(명부 N개, 질문 Q개)"""
    if case == "random":
        # 명부는 서로 다른 이름. 질문의 절반은 명부에 있고 절반은 없다
        nxt = make(20261019)
        taken = set()
        book = fresh(nxt, N, taken)
        absent = fresh(nxt, Q // 2, taken)
        qs = [book[nxt(N)] for _ in range(Q - Q // 2 - 1)] + absent
    elif case == "absent":
        # 질문의 대부분(95%)이 명부에 없는 이름이라, 명부를 끝까지 훑는 풀이가 가장 오래 걸린다.
        # 명부에 없는 이름 가운데 절반은 명부의 이름에서 한 글자만 바꾼 것(앞부분이 같아 비교가 길다)
        nxt = make(707)
        taken = set()
        book = fresh(nxt, N, taken)
        absent = []
        while len(absent) < Q * 19 // 40:
            w = book[nxt(N)]
            k = nxt(len(w))
            v = w[:k] + LETTERS[nxt(26)] + w[k + 1:]
            if v not in taken:
                taken.add(v)
                absent.append(v)
        absent += fresh(nxt, Q * 19 // 20 - len(absent), taken)
        qs = [book[nxt(N)] for _ in range(Q - len(absent) - 1)] + absent
    else:
        # repeat: 명부에 같은 이름이 여러 번 적혀 있고(서로 다른 이름 5만 개를 네 번씩, 마지막 이름만 한 번),
        # 같은 사람이 여러 번 지나가려 한다(서로 다른 질문 이름 2만 개)
        nxt = make(1407)
        taken = set()
        base = fresh(nxt, N // 4, taken)
        last = base.pop()
        book = base * 4
        book += [base[nxt(len(base))] for _ in range(N - len(book) - 1)]
        shuffle(nxt, book)
        book.append(last)
        absent = fresh(nxt, 10000, taken)
        pool = base[:10000] + absent
        qs = [pool[nxt(len(pool))] for _ in range(Q - 1)]
    shuffle(nxt, qs)
    return book, [book[-1]] + qs


def solve(book, qs):
    s = set(book)
    return ["1" if w in s else "0" for w in qs]


def generate(case):
    book, qs = build(case)
    lines = [str(len(book))] + book + [str(len(qs))] + qs
    return "\n".join(lines) + "\n", "\n".join(solve(book, qs)) + "\n"
