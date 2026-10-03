import sys
input = sys.stdin.readline

n, m = map(int, input().split())
names = []
number_of = {}
for i in range(n):
    name = input().rstrip()
    names.append(name)
    number_of[name] = i + 1
for _ in range(m):
    q = input().rstrip()
    if q.isdigit():
        print(names[int(q)])
    else:
        print(number_of[q])
