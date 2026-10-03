import sys
input = sys.stdin.readline

n = int(input())
cargo = input().split()
q = int(input())
for _ in range(q):
    name = input().rstrip()
    print(cargo.count(name))
best = ""
best_count = 0
for name in sorted(set(cargo)):
    c = cargo.count(name)
    if c > best_count:
        best = name
        best_count = c
print(best)
