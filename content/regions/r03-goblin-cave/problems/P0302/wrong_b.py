import sys
input = sys.stdin.readline

coins = input().split()
total = 0
for c in coins:
    total += int(c)
print(total)
print(max(coins))
print(min(coins))
