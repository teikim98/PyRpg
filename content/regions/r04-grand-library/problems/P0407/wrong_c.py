def solution(records):
    answer = []
    for r in records:
        name, n, fee = r[0], r[1], r[2]
        answer.append(name + ": " + n + "권 " + fee + "골드")
    return answer
