import sys
input = sys.stdin.readline

n = int(input())
people = []
for _ in range(n):
    name, row, swim, dive = input().split()
    people.append((name, int(row), int(swim), int(dive)))

# 정렬은 안정 정렬이라 같은 값끼리는 앞의 순서를 지킨다.
# 그래서 가장 덜 중요한 기준부터 거꾸로 한 번씩 정렬하면 된다
people.sort(key=lambda p: p[0])                 # 넷째: 이름 사전순
people.sort(key=lambda p: p[3], reverse=True)   # 셋째: 잠수 큰 것부터
people.sort(key=lambda p: p[2])                 # 둘째: 헤엄 작은 것부터
people.sort(key=lambda p: p[1], reverse=True)   # 첫째: 노 젓기 큰 것부터
for p in people:
    print(p[0])
