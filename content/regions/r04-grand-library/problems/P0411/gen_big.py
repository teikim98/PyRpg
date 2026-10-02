# P0411 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 네 경우 모두 N, Q가 같아서(같은 크기) phases[2].stopOnTle을 쓸 수 있다.
N = 150000
Q = 800000
LETTERS = "abcdefghijklmnopqrstuvwxyz"

# 경우마다 (시드, 명령 비율 SET:SWAP:UPPER, 칸 고르기)
CASES = {
    # 섞인 명령(SWAP이 가장 많음), 칸은 고르게
    "random": (20261002, (1, 8, 1), "any"),
    # 모두 같은 글자 'a'. UPPER와 SET이 맨 뒤 1000칸에 몰려 같은 칸에 여러 번 걸리고, SET이 대문자를 소문자로 덮는다
    "upper": (4, (1, 7, 2), "back"),
    # 거의 SWAP만. 같은 칸끼리 맞바꾸기(i = j)도 섞인다
    "swap": (2026, (1, 12, 1), "any"),
    # 맨 앞·맨 끝 칸과 그 이웃(1, 2, N - 1, N)을 고친다. SWAP의 상대 칸은 어디든
    "edges": (1002, (1, 8, 1), "edges"),
}


def build(case):
    """(문자열, 명령 줄 목록). 명령의 칸 번호는 문제처럼 1부터"""
    seed, (w_set, w_swap, w_upper), where = CASES[case]
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    if case == "upper":
        s = "a" * N
    else:
        s = "".join([LETTERS[nxt(26)] for _ in range(N)])
    edge = (1, 2, N - 1, N)

    def pick():
        if where == "edges":
            return edge[nxt(4)]
        if where == "back":
            return N - nxt(1000)
        return nxt(N) + 1

    total = w_set + w_swap + w_upper
    cmds = []
    for _ in range(Q):
        t = nxt(total)
        if t < w_set:
            cmds.append("SET " + str(pick()) + " " + LETTERS[nxt(26)])
        elif t < w_set + w_swap:
            i = pick()
            # 다섯 번에 한 번은 같은 칸끼리 맞바꾼다(i = j). 'any'가 아니면 맞바꿀 상대는 어느 칸에서나 고른다
            if nxt(5) == 0:
                j = i
            else:
                j = pick() if where == "any" else nxt(N) + 1
            cmds.append("SWAP " + str(i) + " " + str(j))
        else:
            cmds.append("UPPER " + str(pick()))
    return s, cmds


def solve(s, cmds):
    arr = list(s)
    for line in cmds:
        p = line.split()
        if p[0] == "SET":
            arr[int(p[1]) - 1] = p[2]
        elif p[0] == "SWAP":
            i, j = int(p[1]) - 1, int(p[2]) - 1
            arr[i], arr[j] = arr[j], arr[i]
        else:
            i = int(p[1]) - 1
            arr[i] = arr[i].upper()
    out = "".join(arr)
    return out, sum(1 for c in out if c.isupper())


def generate(case):
    s, cmds = build(case)
    out, upper = solve(s, cmds)
    return s + "\n" + str(len(cmds)) + "\n" + "\n".join(cmds) + "\n", out + "\n" + str(upper) + "\n"
