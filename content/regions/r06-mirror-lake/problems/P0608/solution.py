import sys
input = sys.stdin.readline

n = int(input())
people = []
for _ in range(n):
    name, row, swim, dive = input().split()
    people.append((name, int(row), int(swim), int(dive)))

# 노 젓기는 큰 것부터(-), 헤엄은 작은 것부터, 잠수는 큰 것부터(-), 모두 같으면 이름 사전순
people.sort(key=lambda p: (-p[1], p[2], -p[3], p[0]))
print("\n".join(p[0] for p in people))
