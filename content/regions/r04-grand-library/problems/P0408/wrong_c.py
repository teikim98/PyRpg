import sys
input = sys.stdin.readline

s = input().rstrip()
cnt = [0] * 26
for c in s:
    cnt[ord(c) - 96] += 1
print(*cnt)
