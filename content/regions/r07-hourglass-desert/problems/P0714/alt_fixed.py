import sys

LIMIT = 1000000   # 수의 범위(10^6 이하)를 알고 있으니 체를 처음부터 그 크기로 만든다
is_prime = [True] * (LIMIT + 1)
is_prime[0] = False
is_prime[1] = False
i = 2
while i * i <= LIMIT:
    if is_prime[i]:
        for j in range(i * i, LIMIT + 1, i):
            is_prime[j] = False
    i += 1

data = sys.stdin.read().split()
q = int(data[0])
count = 0
total = 0
for k in range(1, q + 1):
    x = int(data[k])
    if is_prime[x]:
        count += 1
        total += x
print(count)
print(total)
