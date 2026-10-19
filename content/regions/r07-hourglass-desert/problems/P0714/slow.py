import sys

data = sys.stdin.read().split()
q = int(data[0])
count = 0
total = 0
for k in range(1, q + 1):
    n = int(data[k])
    if n < 2:
        continue
    # 수마다 2부터 √n까지 나눠 본다(수 하나에 O(√n), 전체 O(Q√M))
    prime = True
    i = 2
    while i * i <= n:
        if n % i == 0:
            prime = False
            break
        i += 1
    if prime:
        count += 1
        total += n
print(count)
print(total)
