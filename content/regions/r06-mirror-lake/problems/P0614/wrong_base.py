import sys
input = sys.stdin.readline

memo = {}


def echo(n):
    if n == 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = echo(n // 2) + echo(n // 3)
    return memo[n]


q = int(input())
for _ in range(q):
    n = int(input())
    print(echo(n))
