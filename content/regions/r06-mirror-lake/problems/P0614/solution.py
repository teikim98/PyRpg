import sys
input = sys.stdin.readline

memo = {}   # 세기 → 울린 횟수. 한 번 구한 값은 여기 적어 두고 다시 계산하지 않는다


def echo(n):
    if n == 0:              # 기저 조건: 세기 0의 메아리는 한 번 울린다
        return 1
    if n in memo:
        return memo[n]
    memo[n] = echo(n // 2) + echo(n // 3)
    return memo[n]


q = int(input())
for _ in range(q):
    n = int(input())
    print(echo(n))
