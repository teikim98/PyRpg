import sys
input = sys.stdin.readline

n = int(input())
cargo = input().split()
count = {}
for c in cargo:
    count[c] = count.get(c, 0) + 1
q = int(input())
for _ in range(q):
    name = input().rstrip()
    print(count.get(name, 0))
best = ""
for name, c in count.items():
    if best == "" or c > count[best] or (c == count[best] and name < best):
        best = name
print(best)
