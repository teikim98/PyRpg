import sys
from collections import Counter
input = sys.stdin.readline

n = int(input())
cargo = input().split()
count = Counter(cargo)
q = int(input())
for _ in range(q):
    name = input().rstrip()
    print(count[name])
print(count.most_common(1)[0][0])
