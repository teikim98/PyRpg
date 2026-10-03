import sys
input = sys.stdin.readline

q = int(input())
for _ in range(q):
    n = int(input())
    # 0부터 n까지 칸을 모두 만들어 아래에서부터 채운다
    dp = [0] * (n + 1)
    dp[0] = 1
    for i in range(1, n + 1):
        dp[i] = dp[i // 2] + dp[i // 3]
    print(dp[n])
