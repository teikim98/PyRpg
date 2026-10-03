import sys
input = sys.stdin.readline

n = int(input())
banned = set(input().split())
q = int(input())
for _ in range(q):
    item = input()
    if item in banned:
        print("압수")
    else:
        print("통과")
