import sys
input = sys.stdin.readline

s = input().rstrip()
count = 0
for c in s:
    if c in "aeiou":
        count += 1
print(count)
