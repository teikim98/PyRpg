import sys
input = sys.stdin.readline

real = list(map(int, input().split()))
shadow = list(map(int, input().split()))

diffs = []
for i in range(len(real)):
    diffs.append(real[i] - shadow[i])
print(*diffs)
print(len([d for d in diffs if d != 0]))
