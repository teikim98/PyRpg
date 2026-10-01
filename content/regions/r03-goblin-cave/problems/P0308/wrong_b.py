def solution(gems):
    for g in gems:
        if g % 2 == 1:
            gems.remove(g)
    return gems
