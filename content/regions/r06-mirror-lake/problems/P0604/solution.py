import sys
input = sys.stdin.readline

real = list(map(int, input().split()))
shadow = list(map(int, input().split()))

diffs = [a - b for a, b in zip(real, shadow)]
print(*diffs)
print(sum(1 for d in diffs if d != 0))
