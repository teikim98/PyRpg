import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))
result = []
for i in range(n):
    result.append(max(arr[:i + 1]))
print(*result)
