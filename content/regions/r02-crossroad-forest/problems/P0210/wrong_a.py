import sys
input = sys.stdin.readline

n = int(input())
count = 0
i = 1
while i * i <= n:
    if n % i == 0:
        count += 2
    i += 1
print(count)
