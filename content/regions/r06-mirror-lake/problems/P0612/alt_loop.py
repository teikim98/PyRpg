def solution(n):
    dp = [0] * (n + 1)
    dp[0] = 1
    for k in range(1, n + 1):
        dp[k] = dp[k - 1]
        if k >= 2:
            dp[k] += dp[k - 2]
        if k >= 3:
            dp[k] += dp[k - 3]
    return dp[n]
