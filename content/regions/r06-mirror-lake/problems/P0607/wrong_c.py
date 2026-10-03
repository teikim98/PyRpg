import sys
input = sys.stdin.readline

n = int(input())
words = set()
for _ in range(n):
    words.add(input().rstrip())

words = list(words)
for w in words.sort(key=lambda w: (len(w), w)):
    print(w)
