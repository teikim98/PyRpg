def solution(s, n):
    answer = ""
    for c in s:
        if c == " ":
            answer += c
        else:
            answer += chr(ord(c) + n)
    return answer
