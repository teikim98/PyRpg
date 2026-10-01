n = int(input())
key = n
for i in range(2, n + 1):
    if n % i == 0:
        key = i
print(key)
