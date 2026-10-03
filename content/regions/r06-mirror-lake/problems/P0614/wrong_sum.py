import sys
input = sys.stdin.readline

memo = {}


def echo(n):
    if n == 0:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = echo(n // 2) + echo(n // 3)
    return memo[n]


q = int(input())
total = 0
for _ in range(q):
    n = int(input())
    total += echo(n)
print(total)
