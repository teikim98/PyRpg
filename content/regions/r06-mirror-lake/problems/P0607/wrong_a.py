import sys
input = sys.stdin.readline

n = int(input())
words = []
for _ in range(n):
    words.append(input().rstrip())

for w in sorted(words, key=lambda w: (len(w), w)):
    print(w)
