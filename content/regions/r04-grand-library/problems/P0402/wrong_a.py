def solution(title):
    low = title.lower()
    return low == low[::-1]
