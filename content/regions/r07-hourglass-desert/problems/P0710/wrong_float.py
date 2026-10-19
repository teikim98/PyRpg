import math


def solution(a, b):
    g = math.gcd(a, b)
    return [g, a * b / g]
