def solution(words):
    count = {}
    for w in words:
        count[w] = count.get(w, 0) + 1
    return count
