import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))
print(*arr[::-1])
print(*arr[1::2])
