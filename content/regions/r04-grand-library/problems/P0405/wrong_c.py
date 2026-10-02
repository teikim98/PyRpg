import sys
input = sys.stdin.readline

t = input().rstrip()
w = input().rstrip()
print(t.find(w) + 1, t.count(w))
