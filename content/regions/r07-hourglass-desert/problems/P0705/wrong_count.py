def solution(names):
    for name in names:
        if names.count(name) >= 2:
            return name
    return "없음"
