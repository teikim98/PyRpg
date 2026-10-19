import sys

total = 0
broken = 0
for line in sys.stdin:
    name, weight = line.split()
    total += int(weight)
print(total)
print(broken)
