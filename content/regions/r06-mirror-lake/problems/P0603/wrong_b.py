def solution(depths, limit):
    answer = []
    for i, d in enumerate(depths, 1):
        if d >= limit:
            answer.append(i)
    return answer
