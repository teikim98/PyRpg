def solution(words, n):
    return sorted(words, key=lambda w: w[n])
