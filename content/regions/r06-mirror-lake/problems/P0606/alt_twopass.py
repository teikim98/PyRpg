def solution(words, n):
    words.sort()
    words.sort(key=lambda w: w[n])
    return words
