import sys
input = sys.stdin.readline

n = int(input())
book = {}
for _ in range(n):
    book[input().strip()] = True  # dict의 키로 찾아도 set과 같은 평균 O(1)
q = int(input())
out = []
for _ in range(q):
    if input().strip() in book:
        out.append("1")
    else:
        out.append("0")
print("\n".join(out))
