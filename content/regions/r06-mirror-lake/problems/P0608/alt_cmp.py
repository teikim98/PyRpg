import sys
from functools import cmp_to_key
input = sys.stdin.readline

n = int(input())
people = []
for _ in range(n):
    name, row, swim, dive = input().split()
    people.append((name, int(row), int(swim), int(dive)))


def compare(p, q):
    """p가 앞이면 음수, 뒤면 양수(JS의 sort((a, b) => ...)와 같은 비교 함수)"""
    if p[1] != q[1]:
        return q[1] - p[1]      # 노 젓기 큰 것부터
    if p[2] != q[2]:
        return p[2] - q[2]      # 헤엄 작은 것부터
    if p[3] != q[3]:
        return q[3] - p[3]      # 잠수 큰 것부터
    if p[0] < q[0]:             # 이름 사전순
        return -1
    if p[0] > q[0]:
        return 1
    return 0


people.sort(key=cmp_to_key(compare))
print("\n".join(p[0] for p in people))
