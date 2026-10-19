import sys

amounts = sys.stdin.read().split()
total = 0
for a in amounts:
    total += int(a)
print(total, len(amounts))
