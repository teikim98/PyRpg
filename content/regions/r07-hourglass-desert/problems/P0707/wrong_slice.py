import sys

data = sys.stdin.read().split()
n = int(data[0])
book = set(data[1:n])
q = int(data[n + 1])
out = []
for name in data[n + 2:n + 2 + q]:
    if name in book:
        out.append("1")
    else:
        out.append("0")
print("\n".join(out))
