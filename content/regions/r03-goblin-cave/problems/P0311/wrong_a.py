import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))
result = []
best = 0
for x in arr:
    if x > best:
        best = x
    result.append(best)
print(*result)
