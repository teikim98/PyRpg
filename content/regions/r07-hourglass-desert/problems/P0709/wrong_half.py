def solution(n):
    is_prime = [True] * (n + 1)
    is_prime[0] = False
    is_prime[1] = False
    i = 2
    while i * i <= n:
        if is_prime[i]:
            for j in range(i * i, n + 1, i):
                is_prime[j] = False
        i += 1

    count = 0
    for p in range(2, n // 2):
        if is_prime[p] and is_prime[n - p]:
            count += 1
    return count
