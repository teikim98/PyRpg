import sys
input = sys.stdin.readline

n = int(input())
grid = []
for _ in range(n):
    grid.append(list(map(int, input().split())))

longest = max([len(row) for row in grid])
board = [[-1] * longest] * n
for r in range(n):
    for c in range(len(grid[r])):
        board[r][c] = grid[r][c]

result = []
for c in range(longest):
    for r in range(n):
        if board[r][c] != -1:
            result.append(board[r][c])
print(*result)
