import sys
input = sys.stdin.readline

t = input().rstrip()
w = input().rstrip()
print(t.index(w), t.count(w))
