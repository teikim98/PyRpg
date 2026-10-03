def solution(words, n):
    return words.sort(key=lambda w: (w[n], w))
