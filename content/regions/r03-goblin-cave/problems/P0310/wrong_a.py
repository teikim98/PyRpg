import sys
input = sys.stdin.readline

n = int(input())
grid = []
for _ in range(n):
    grid.append(list(map(int, input().split())))

longest = max([len(row) for row in grid])
result = []
for c in range(longest):
    for r in range(n):
        result.append(grid[r][c])
print(*result)
