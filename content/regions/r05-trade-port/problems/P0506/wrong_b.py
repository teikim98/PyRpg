def solution(cargo):
    seen = set()
    for x in cargo:
        if x in seen:
            return x
        seen.add(x)
