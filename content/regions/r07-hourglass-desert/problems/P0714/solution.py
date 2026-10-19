import sys

data = sys.stdin.read().split()
q = int(data[0])
nums = [int(x) for x in data[1:q + 1]]

# 입력의 가장 큰 수 m까지 체를 한 번 만든다. 칸 번호가 곧 수라서 크기는 m + 1(1번 칸이 늘 있게 2 이상)
m = max(nums)
if m < 2:
    m = 2
is_prime = [True] * (m + 1)
is_prime[0] = False
is_prime[1] = False
i = 2
while i * i <= m:
    if is_prime[i]:
        for j in range(i * i, m + 1, i):   # i의 배수를 i * i부터 지운다(더 작은 배수는 이미 지워짐)
            is_prime[j] = False
    i += 1

# 표에서 한 번씩 보기만 하면 된다
count = 0
total = 0
for x in nums:
    if is_prime[x]:
        count += 1
        total += x
print(count)
print(total)
