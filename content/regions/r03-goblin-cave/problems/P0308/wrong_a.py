def solution(gems):
    return gems.filter(lambda g: g % 2 == 0)
