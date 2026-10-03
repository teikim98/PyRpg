def solution(departed, returned):
    return sorted(set(departed) - set(returned))
