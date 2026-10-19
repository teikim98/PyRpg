import sys
input = sys.stdin.readline

n, k = map(int, input().split())
weights = list(map(int, input().split()))
count = {}
pairs = 0
for w in weights:
    pairs += count.get(k - w, 0)
    count[w] = count.get(w, 0) + 1
print(pairs)
