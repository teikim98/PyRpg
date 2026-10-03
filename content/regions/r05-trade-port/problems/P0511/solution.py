from collections import Counter


def solution(departed, returned):
    missing = Counter(departed) - Counter(returned)
    return sorted(missing.elements())
