total = 0
broken = 0
while True:
    try:
        name, weight = input().split()
        total += int(weight)
    except ValueError:
        broken += 1
print(total)
print(broken)
