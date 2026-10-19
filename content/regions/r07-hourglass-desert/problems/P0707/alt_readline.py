import sys
input = sys.stdin.readline

n = int(input())
book = {input().strip() for _ in range(n)}
q = int(input())
for _ in range(q):
    if input().strip() in book:
        print(1)
    else:
        print(0)
