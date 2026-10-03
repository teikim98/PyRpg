from collections import Counter


def solution(cargo):
    count = Counter(cargo)
    return count.most_common(1)
