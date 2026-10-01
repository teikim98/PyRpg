# P0311 시간 결계(2페이즈) 입력 생성기(design.md §11.1).
# 게임(Pyodide)과 검증기(CPython)가 채점 직전에 generate(case)를 불러 (입력, 기대 출력)을 만든다.
# random 모듈 대신 시드를 고정한 선형 합동 생성기를 써서 어느 Python에서나 같은 값이 나온다.
N = 200000


def values(case):
    if case == "desc":
        # 999에서 -999까지 내려가는 줄(최댓값이 처음부터 끝까지 999)
        return [999 - (1999 * i) // N for i in range(N)]
    if case == "asc":
        # -999에서 999까지 올라가는 줄(음수로 시작, 최댓값이 계속 바뀜)
        return [-999 + (1999 * i) // N for i in range(N)]
    if case == "random":
        x = 20261001
        out = []
        for _ in range(N):
            x = (x * 1103515245 + 12345) % 2147483648
            out.append((x >> 8) % 1999 - 999)
        return out
    if case == "equal":
        # 모두 같은 음수
        return [-7] * N
    raise ValueError(f"모르는 case: {case}")


def generate(case):
    arr = values(case)
    best = arr[0]
    maxes = []
    for x in arr:
        if x > best:
            best = x
        maxes.append(best)
    return f"{N}\n" + " ".join(map(str, arr)) + "\n", " ".join(map(str, maxes)) + "\n"
