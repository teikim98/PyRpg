import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))
odd = arr[::2]
rev = arr.reverse()
print(*rev)
print(*odd)
