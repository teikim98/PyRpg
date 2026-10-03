import sys
input = sys.stdin.readline

R, C = map(int, input().split())
grid = [input().rstrip() for _ in range(R)]


def paths(r, c):
    if r >= R or c >= C or grid[r][c] == "#":
        return 0
    if r == R - 1 and c == C - 1:
        return 1
    return paths(r, c + 1) + paths(r + 1, c)


print(paths(0, 0))
