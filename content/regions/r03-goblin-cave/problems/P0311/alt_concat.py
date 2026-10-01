import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))
out = ""
best = arr[0]
for x in arr:
    if x > best:
        best = x
    out += str(best) + " "
print(out)
