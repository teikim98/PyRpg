import sys
input = sys.stdin.readline

n = int(input())
best_name = ""
best_scores = []
best_total = -1
for _ in range(n):
    name, *scores = input().split()
    total = sum(scores)
    print(name, total, max(scores))
    if total > best_total:
        best_name, best_scores, best_total = name, scores, total
print(best_name, *best_scores)
