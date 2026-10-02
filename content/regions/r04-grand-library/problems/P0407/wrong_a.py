def solution(records):
    answer = []
    for r in records:
        name, n, fee = r[0], r[1], r[2]
        answer.append(f"{name}: {n}권 {fee:.2f}골드")
    return answer
