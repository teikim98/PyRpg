from functools import lru_cache


@lru_cache(maxsize=None)
def ways(k):
    if k < 0:
        return 0
    if k == 0:
        return 1
    return ways(k - 1) + ways(k - 2) + ways(k - 3)


def solution(n):
    return ways(n)
