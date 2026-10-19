import sys

lines = sys.stdin.read().split("\n")
total = 0
for line in lines:
    total += int(line)
print(total, len(lines))
