import sys
input = sys.stdin.readline

n = int(input())
words = set()
for _ in range(n):
    words.add(input().rstrip())

print(sorted(words, key=lambda w: (len(w), w)))
