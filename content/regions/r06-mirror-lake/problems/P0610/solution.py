def solution(grid):
    answer = [0, 0]

    def compress(r, c, size):
        first = grid[r][c]
        same = True
        for i in range(r, r + size):
            for j in range(c, c + size):
                if grid[i][j] != first:
                    same = False
        if same:
            answer[first] += 1
            return
        half = size // 2
        compress(r, c, half)
        compress(r, c + half, half)
        compress(r + half, c, half)
        compress(r + half, c + half, half)

    compress(0, 0, len(grid))
    return answer
