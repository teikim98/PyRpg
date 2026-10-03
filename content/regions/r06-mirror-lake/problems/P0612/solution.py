def solution(n):
    memo = {0: 1}

    def ways(k):
        if k < 0:
            return 0
        if k in memo:
            return memo[k]
        memo[k] = ways(k - 1) + ways(k - 2) + ways(k - 3)
        return memo[k]

    return ways(n)
