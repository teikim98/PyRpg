import sys
input = sys.stdin.readline

n, k = map(int, input().split())
weights = list(map(int, input().split()))
count = {}
pairs = 0
for w in weights:
    count[w] = count.get(w, 0) + 1
    pairs += count.get(k - w, 0)
print(pairs)
