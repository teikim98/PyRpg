def digit_sum(n):
    if n < 10:
        return n
    return n % 10 + digit_sum(n // 10)


def solution(n):
    count = 0
    if n >= 10:
        n = digit_sum(n)
        count += 1
    return count
