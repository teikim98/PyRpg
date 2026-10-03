def solution(cargo):
    count = Counter(cargo)
    top = max(count.values())
    return min([name for name, n in count.items() if n == top])
