import sys
input = sys.stdin.readline

real = list(map(int, input().split()))
shadow = list(map(int, input().split()))

pairs = zip(real, shadow)
diffs = [a - b for a, b in pairs]
print(*diffs)
count = 0
for a, b in pairs:
    if a != b:
        count += 1
print(count)
