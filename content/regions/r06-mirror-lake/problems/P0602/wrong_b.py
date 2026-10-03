import sys
input = sys.stdin.readline


def dist(p, q):
    return (q[0] - p[0]) + (q[1] - p[1])


n = int(input())
points = []
for _ in range(n):
    x, y = map(int, input().split())
    points.append((x, y))

total = 0
for i in range(1, n):
    total += dist(points[i - 1], points[i])
print(total)
