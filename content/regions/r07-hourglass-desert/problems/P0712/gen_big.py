# P0712 큰 입력 생성기(design.md §11.1). 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러
# (입력, 기대 출력)을 만든다. random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
# 줄 10만 개: 서로 다른 이름의 올바른 짐(무게는 G의 배수, 몇 개는 G 그대로), 깨진 줄, 무게 0인 짐,
# 무게가 양수였던 이름이 다시 나오는 줄(무게는 G의 배수가 아님)을 섞는다. 그래서 기대 출력은 G이고,
# 다시 나온 이름까지 세면 답이 G보다 작아진다. 입력은 1.7 MB 안팎이다.
N = 100000
G = 999983
LETTERS = "abcdefghijklmnopqrstuvwxyz"


def make(seed):
    x = seed

    def nxt(m):
        nonlocal x
        x = (x * 1103515245 + 12345) % 2147483648
        return (x >> 8) % m

    return nxt


def name_of(i):
    """서로 다른 i에 서로 다른 6글자 이름(26^6 안에서 7919를 곱하는 것은 일대일)"""
    v = (i * 7919 + 12345) % (26 ** 6)
    out = []
    for _ in range(6):
        v, r = divmod(v, 26)
        out.append(LETTERS[r])
    return "".join(out)


def generate(case):
    nxt = make(20261019)
    lines = []
    names = []
    for i in range(N):
        r = nxt(100)
        if r < 3 and names:
            # 앞에 나온 이름이 다시 나옴: 무게는 G의 배수가 아님(세면 안 됨)
            lines.append(f"{names[nxt(len(names))]} {G * (1 + nxt(1000)) + 1 + nxt(G - 1)}")
            continue
        name = name_of(i)
        if r < 6:
            bad = ("kg", "?", ".5", "x")[nxt(4)]
            lines.append(f"{name} {1 + nxt(100000)}{bad}")
            continue
        if r < 8:
            # 무게 0인 짐의 이름은 다시 나오게 하지 않는다(0을 거르는 순서와 이름 확인 순서가 답에 영향을 주지 않게)
            lines.append(f"{name} 0")
            continue
        names.append(name)
        if r < 9:
            lines.append(f"{name} {G}")
        else:
            lines.append(f"{name} {G * (1 + nxt(1000))}")
    return "\n".join(lines) + "\n", f"{G}\n"
