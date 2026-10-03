import sys
input = sys.stdin.readline

n, m = map(int, input().split())
ship_a = [input().rstrip() for _ in range(n)]
ship_b = set()
for _ in range(m):
    ship_b.add(input().rstrip())
common = [x for x in ship_a if x in ship_b]
print(len(common))
for name in common:
    print(name)
