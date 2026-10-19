import sys
import math

seen = set()
weights = []
for line in sys.stdin:
    name, w = line.split()
    try:
        weight = int(w)
    except ValueError:
        continue
    if name in seen:
        continue
    seen.add(name)
    weights.append(weight)

if not weights:
    print("없음")
else:
    g = 0
    for weight in weights:
        g = math.gcd(g, weight)
    print(g)
