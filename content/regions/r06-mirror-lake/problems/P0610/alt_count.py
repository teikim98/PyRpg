def count(grid, r, c, size):
    first = grid[r][c]
    if all(grid[i][j] == first for i in range(r, r + size) for j in range(c, c + size)):
        return (1, 0) if first == 0 else (0, 1)
    half = size // 2
    zeros, ones = 0, 0
    for dr, dc in [(0, 0), (0, half), (half, 0), (half, half)]:
        z, o = count(grid, r + dr, c + dc, half)
        zeros += z
        ones += o
    return zeros, ones


def solution(grid):
    return count(grid, 0, 0, len(grid))
