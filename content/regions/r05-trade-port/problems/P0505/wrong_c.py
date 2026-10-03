import sys
input = sys.stdin.readline

n, m = map(int, input().split())
name_of = {}
number_of = {}
for i in range(1, n + 1):
    name = input()
    name_of[i] = name
    number_of[name] = i
for _ in range(m):
    q = input()
    if q.isdigit():
        print(name_of[int(q)])
    else:
        print(number_of[q])
