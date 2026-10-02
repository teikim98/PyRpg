import sys
input = sys.stdin.readline

s = input().rstrip()
answer = ""
for c in s:
    if c.isupper():
        answer += c.toLowerCase()
    else:
        answer += c.toUpperCase()
print(answer)
