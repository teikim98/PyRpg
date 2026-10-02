import sys
input = sys.stdin.readline

s = input().rstrip()
answer = ""
for c in s:
    if c.isupper():
        c.lower()
    elif c.islower():
        c.upper()
    answer += c
print(answer)
