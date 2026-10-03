import sys
input = sys.stdin.readline

n = int(input())
people = []
for _ in range(n):
    name, row, swim, dive = input().split()
    people.append((name, int(row), int(swim), int(dive)))

people.sort(key=lambda p: (p[1], -p[2], p[3], -p[0]), reverse=True)
print("\n".join([p[0] for p in people]))
