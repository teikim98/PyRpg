import sys

data = sys.stdin.read().split()
n = int(data[0])
book = set(data[1:n + 1])
q = int(data[n + 1])
out = []
for name in data[n + 2:n + 2 + q]:
    out.append(str(name in book))
print("\n".join(out))
