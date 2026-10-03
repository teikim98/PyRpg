def solution(words):
    count = {}
    for w in words:
        count[w] += 1
    answer = []
    for w, n in count.items():
        answer.append((w, n))
    return answer
