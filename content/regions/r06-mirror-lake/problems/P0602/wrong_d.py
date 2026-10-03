import sys
input = sys.stdin.readline


def dist(p, q):
    return abs(p[0] - q[0]) + abs(p[1] - q[1])


n = int(input())
points = []
for _ in range(n):
    x, y = map(int, input().split())
    points.append((x, y))

total = 0
for i in range(n):
    total += dist(points[i - 1], points[i])
print(total)
