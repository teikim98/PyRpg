import sys
input = sys.stdin.readline

words = input().rstrip().split(" ")
print(" ".join(words[::-1]))
