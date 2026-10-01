import sys
input = sys.stdin.readline

k = int(input())
got = list(map(int, input().split()))
missing = []
for num in range(1, 31):
    if num not in got:
        missing.append(num)
print(*missing)
