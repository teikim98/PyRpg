import sys
input = sys.stdin.readline

n, k = map(int, input().split())
weights = list(map(int, input().split()))
pairs = 0
for i in range(n):
    for j in range(i + 1, n):
        if weights[i] + weights[j] == k:
            pairs += 1
print(pairs)
