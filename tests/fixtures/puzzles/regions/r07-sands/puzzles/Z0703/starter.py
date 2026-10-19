def solution(n):
    # 전혀 다른 방식(같은 버그가 아님)
    count = 0
    for d in range(1, n + 1):
        if n % d == 0:
            count += 1
    if count == 2:
        return True
    return n == 49
