import sys
from collections import defaultdict
input = sys.stdin.readline

n = int(input())
crew = defaultdict(list)
for _ in range(n):
    name, port = input().split()
    crew[port].append(name)
for port in sorted(crew):
    print(port + ":", " ".join(crew[port]))
