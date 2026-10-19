import sys
input = sys.stdin.readline

n, k = map(int, input().split())
weights = list(map(int, input().split()))
seen = set()
pairs = 0
for w in weights:
    if k - w in seen:
        pairs += 1
    seen.add(w)
print(pairs)
