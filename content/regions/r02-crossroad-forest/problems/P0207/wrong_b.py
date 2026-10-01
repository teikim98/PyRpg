def solution(n):
    answer = 0
    while n != 1:
        if n % 2 == 0:
            n = n // 2
        else:
            n * 3 + 1
        answer += 1
    return answer
