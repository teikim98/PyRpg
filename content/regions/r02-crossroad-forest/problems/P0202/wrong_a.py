def solution(score):
    if score >= 60:
        answer = "D"
    elif score >= 70:
        answer = "C"
    elif score >= 80:
        answer = "B"
    elif score >= 90:
        answer = "A"
    else:
        answer = "F"
    return answer
