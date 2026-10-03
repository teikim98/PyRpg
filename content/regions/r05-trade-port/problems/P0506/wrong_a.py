def solution(cargo):
    seen = {}
    for x in cargo:
        if x in seen:
            return x
        seen.add(x)
    return -1
