import sys
input = sys.stdin.readline

n, m = map(int, input().split())
ship_a = set()
for _ in range(n):
    ship_a.add(input().rstrip())
ship_b = set()
for _ in range(m):
    ship_b.add(input().rstrip())
common = sorted(ship_a & ship_b)
print(len(common))
for name in common:
    print(name)
