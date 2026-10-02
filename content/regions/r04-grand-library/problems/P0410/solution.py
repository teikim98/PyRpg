import sys
input = sys.stdin.readline

s = input().rstrip()
answer = ""
for c in s:
    if c.isupper():
        answer += c.lower()
    elif c.islower():
        answer += c.upper()
    else:
        answer += c
print(answer)
