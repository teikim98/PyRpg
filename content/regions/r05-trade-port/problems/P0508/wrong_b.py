import sys
input = sys.stdin.readline

n = int(input())
line = input()
q = int(input())
for _ in range(q):
    item = input().rstrip()
    if item in line:
        print("압수")
    else:
        print("통과")
