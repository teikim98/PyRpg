import sys
input = sys.stdin.readline

n = int(input())
words = []
for _ in range(n):
    w = input().rstrip()
    if w not in words:
        words.append(w)

for w in sorted(words, key=len):
    print(w)
