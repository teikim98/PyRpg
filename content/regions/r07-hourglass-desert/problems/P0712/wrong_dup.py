import sys
import math

g = 0
for line in sys.stdin:
    name, w = line.split()
    try:
        weight = int(w)
    except ValueError:
        continue
    if weight == 0:
        continue
    g = math.gcd(g, weight)

if g == 0:
    print("없음")
else:
    print(g)
