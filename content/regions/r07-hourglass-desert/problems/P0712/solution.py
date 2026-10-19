import sys
import math

seen = set()
g = 0
for line in sys.stdin:
    name, w = line.split()
    try:
        weight = int(w)
    except ValueError:
        continue
    if name in seen:
        continue
    seen.add(name)
    if weight == 0:
        continue
    g = math.gcd(g, weight)

if g == 0:
    print("없음")
else:
    print(g)
