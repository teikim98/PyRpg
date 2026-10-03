def digit_sum(n):
    return n % 10 + digit_sum(n // 10)


def solution(n):
    if n < 10:
        return 0
    return 1 + solution(digit_sum(n))
