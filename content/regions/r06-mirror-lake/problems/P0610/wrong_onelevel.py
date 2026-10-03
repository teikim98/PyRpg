def solution(grid):
    n = len(grid)
    answer = [0, 0]

    def same(r, c, size):
        first = grid[r][c]
        for i in range(r, r + size):
            for j in range(c, c + size):
                if grid[i][j] != first:
                    return False
        return True

    if same(0, 0, n):
        answer[grid[0][0]] += 1
        return answer
    half = n // 2
    for r, c in [(0, 0), (0, half), (half, 0), (half, half)]:
        if same(r, c, half):
            answer[grid[r][c]] += 1
        else:
            for i in range(r, r + half):
                for j in range(c, c + half):
                    answer[grid[i][j]] += 1
    return answer
