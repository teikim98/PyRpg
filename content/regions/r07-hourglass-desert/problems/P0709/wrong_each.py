def is_prime(x):
    if x < 2:
        return False
    i = 2
    while i * i <= x:
        if x % i == 0:
            return False
        i += 1
    return True


def solution(n):
    count = 0
    for p in range(2, n // 2 + 1):
        if is_prime(p) and is_prime(n - p):
            count += 1
    return count
