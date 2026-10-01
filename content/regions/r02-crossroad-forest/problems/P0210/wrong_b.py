import sys
input = sys.stdin.readline

n = int(input())
count = 0
for i in range(1, int(n ** 0.5)):
    if n % i == 0:
        if i * i == n:
            count += 1
        else:
            count += 2
print(count)
