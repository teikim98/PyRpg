import sys
input = sys.stdin.readline

R, C = map(int, input().split())
grid = [input().rstrip() for _ in range(R)]
dp = [[0] * C for _ in range(R)]
for r in range(R):
    for c in range(C):
        if grid[r][c] == "#":
            continue
        if r == 0 and c == 0:
            dp[r][c] = 1
            continue
        if r > 0:
            dp[r][c] += dp[r - 1][c]
        if c > 0:
            dp[r][c] += dp[r][c - 1]
print(dp[R - 1][C - 1])
