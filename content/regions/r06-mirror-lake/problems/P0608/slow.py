import sys
input = sys.stdin.readline

n = int(input())
people = []
for _ in range(n):
    name, row, swim, dive = input().split()
    people.append((name, int(row), int(swim), int(dive)))


def before(p, q):
    """p가 q보다 앞에 서야 하면 True"""
    if p[1] != q[1]:
        return p[1] > q[1]
    if p[2] != q[2]:
        return p[2] < q[2]
    if p[3] != q[3]:
        return p[3] > q[3]
    return p[0] < q[0]


# 선택 정렬: 남은 사람 중 맨 앞에 설 사람을 골라 앞으로 보낸다(N × N)
for i in range(n):
    best = i
    for j in range(i + 1, n):
        if before(people[j], people[best]):
            best = j
    people[i], people[best] = people[best], people[i]
for p in people:
    print(p[0])
