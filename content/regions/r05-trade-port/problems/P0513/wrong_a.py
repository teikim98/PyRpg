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
    print(count[name])
top = max(count.values())
print(min([name for name, c in count.items() if c == top]))
