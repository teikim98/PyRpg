import sys

total = 0
broken = 0
for line in sys.stdin:
    name, weight = line.split()
    try:
        total += int(wieght)
    except:
        broken += 1
print(total)
print(broken)
