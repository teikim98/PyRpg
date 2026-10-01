import sys
input = sys.stdin.readline

coins = list(map(int, input().split()))
print(sum(coins))
print(max(coins))
print(min(coins))
