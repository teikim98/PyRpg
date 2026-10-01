import sys
input = sys.stdin.readline

n = int(input())
best = 0
pos = 0
for i in range(n):
    w = int(input())
    if w > best:
        best = w
        pos = i
print(best, pos)
