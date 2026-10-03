import sys
input = sys.stdin.readline

n = int(input())
swapped = 0
for _ in range(n):
    a, b = input().split()
    if a > b:
        a, b = b, a
        swapped += 1
    print(a, b)
print(swapped)
