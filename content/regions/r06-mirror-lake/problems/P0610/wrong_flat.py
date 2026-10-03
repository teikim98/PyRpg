def solution(grid):
    answer = [0, 0]
    for row in grid:
        for cell in row:
            answer[cell] += 1
    return answer
