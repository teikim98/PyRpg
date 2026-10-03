import sys
input = sys.stdin.readline

real = input().split()
shadow = input().split()

diffs = [a - b for a, b in zip(real, shadow)]
print(*diffs)
print(len([d for d in diffs if d != 0]))
