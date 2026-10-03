import sys
input = sys.stdin.readline

n = int(input())
price = {}
for _ in range(n):
    name, p = input().split()
    if name not in price:
        price[name] = int(p)
q = int(input())
for _ in range(q):
    name = input().rstrip()
    print(price.get(name, "없음"))
