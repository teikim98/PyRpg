import sys
from functools import lru_cache
input = sys.stdin.readline


@lru_cache(maxsize=None)    # 개수 제한 없이 전부 기억한다(@cache와 같음)
def echo(n):
    if n == 0:
        return 1
    return echo(n // 2) + echo(n // 3)


q = int(input())
for _ in range(q):
    n = int(input())
    print(echo(n))
