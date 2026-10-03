def solution(depths, limit):
    answer = []
    for i, d in enumerate(depths, 1):
        if d >= limit:
            answer.append(i)
    if not answer:
        return [-1]
    return answer
