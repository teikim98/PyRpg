import sys
input = sys.stdin.readline

s = input().rstrip()
answer = ""
for c in s:
    if c.isupper():
        answer += chr(ord(c) + 32)
    else:
        answer += chr(ord(c) - 32)
print(answer)
