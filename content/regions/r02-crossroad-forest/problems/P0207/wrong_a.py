def solution(n):
    answer = 1
    while n != 1:
        if n % 2 == 0:
            n = n // 2
        else:
            n = n * 3 + 1
        answer += 1
    return answer
