import sys
input = sys.stdin.readline

t = input().rstrip()
w = input().rstrip()
count = 0
for i in range(len(t)):
    if t[i:i + len(w)] == w:
        count += 1
print(t.find(w), count)
