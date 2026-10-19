def solution(n, k):
    digits = []
    while n > 0:
        n, r = divmod(n, k)
        digits.append(str(r))
    s = "".join(digits[::-1])
    pieces = [int(p) for p in s.split("0") if p]

    m = max(pieces)
    is_prime = [True] * (m + 1)
    is_prime[0] = False
    is_prime[1] = False
    i = 2
    while i * i <= m:
        if is_prime[i]:
            for j in range(i * i, m + 1, i):
                is_prime[j] = False
        i += 1

    count = 0
    for p in pieces:
        if is_prime[p]:
            count += 1
    return count
