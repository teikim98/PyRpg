import sys

data = sys.stdin.read().split()
q = int(data[0])
nums = [int(x) for x in data[1:q + 1]]
m = max(nums)
is_prime = [True] * m
is_prime[0] = False
is_prime[1] = False
i = 2
while i * i < m:
    if is_prime[i]:
        for j in range(i * i, m, i):
            is_prime[j] = False
    i += 1
count = 0
total = 0
for x in nums:
    if is_prime[x]:
        count += 1
        total += x
print(count)
print(total)
