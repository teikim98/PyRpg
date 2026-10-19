import sys

data = sys.stdin.read().split()
q = int(data[0])
nums = [int(x) for x in data[1:q + 1]]
m = max(max(nums), 2)
is_prime = [True] * (m + 1)
is_prime[0] = is_prime[1] = False
i = 2
while i * i <= m:
    if is_prime[i]:
        # 슬라이스 대입으로 i * i, i * i + i, ... 칸을 한 번에 지운다(반복문 대신 C 코드가 채움)
        is_prime[i * i::i] = [False] * len(range(i * i, m + 1, i))
    i += 1
primes = [x for x in nums if is_prime[x]]
print(len(primes))
print(sum(primes))
