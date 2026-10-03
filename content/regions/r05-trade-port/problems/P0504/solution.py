def solution(words):
    count = {}
    for w in words:
        count[w] = count.get(w, 0) + 1
    answer = []
    for w, n in count.items():
        answer.append((w, n))
    return answer
