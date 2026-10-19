def solution(a, b):
    while b:
        a, b = b, a % b
    return [a, a * b // a]
