def solution(treasures, k):
    treasures = treasures.sort()
    return treasures[k - 1]
