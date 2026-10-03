import sys
input = sys.stdin.readline

R, C = map(int, input().split())
grid = [input().rstrip() for _ in range(R)]
memo = {}


def paths(r, c):
    if r >= R or c >= C or grid[r][c] == "#":
        return 0
    if r == R - 1 and c == C - 1:
        return 1
    if (r, c) in memo:
        return memo[(r, c)]
    memo[(r, c)] = paths(r, c + 1) + paths(r + 1, c)
    return memo[(r, c)]


print(paths(0, 0))
