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
    if weight == 0:
        continue
    weights.append(weight)

g = weights[0]
for weight in weights[1:]:
    g = math.gcd(g, weight)
print(g)
