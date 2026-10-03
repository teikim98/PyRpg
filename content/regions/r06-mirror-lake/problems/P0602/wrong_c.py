import sys
input = sys.stdin.readline


def dist(p, q):
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5


n = int(input())
points = []
for _ in range(n):
    x, y = map(int, input().split())
    points.append((x, y))

total = 0
for i in range(1, n):
    total += dist(points[i - 1], points[i])
print(total)
