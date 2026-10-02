import sys
input = sys.stdin.readline

words = input().split()
print(" ".join(words[::-1]))
