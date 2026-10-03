import sys
input = sys.stdin.readline


def echo(n):
    if n == 0:
        return 1
    return echo(n // 2) + echo(n // 3)


q = int(input())
for _ in range(q):
    n = int(input())
    print(echo(n))
