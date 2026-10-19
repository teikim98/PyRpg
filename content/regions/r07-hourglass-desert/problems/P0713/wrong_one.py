def is_prime(x):
    i = 2
    while i * i <= x:
        if x % i == 0:
            return False
        i += 1
    return True


def solution(n, k):
    digits = []
    while n > 0:
        n, r = divmod(n, k)
        digits.append(str(r))
    s = "".join(digits[::-1])

    count = 0
    for piece in s.split("0"):
        if piece and is_prime(int(piece)):
            count += 1
    return count
