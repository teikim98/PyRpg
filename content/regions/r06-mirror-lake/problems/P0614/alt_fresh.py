import sys
input = sys.stdin.readline


def echo(n, memo):
    if n == 0:
        return 1
    if n not in memo:
        memo[n] = echo(n // 2, memo) + echo(n // 3, memo)
    return memo[n]


q = int(input())
for _ in range(q):
    n = int(input())
    print(echo(n, {}))      # 질문마다 새 메모장
