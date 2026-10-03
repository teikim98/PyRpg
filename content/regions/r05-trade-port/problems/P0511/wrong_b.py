from collections import Counter


def solution(departed, returned):
    return Counter(departed) - Counter(returned)
