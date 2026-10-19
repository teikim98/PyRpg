def solution(names):
    seen = set()
    for name in names:
        if name in seen:
            return name
        seen.add(name)
    return "없음"
