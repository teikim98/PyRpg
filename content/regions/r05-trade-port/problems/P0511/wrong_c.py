from collections import Counter


def solution(departed, returned):
    missing = Counter(returned) - Counter(departed)
    return sorted(missing.elements())
