n = int(input())
book = set()
for _ in range(n):
    book.add(input())
q = int(input())
out = []
for _ in range(q):
    if input() in book:
        out.append("1")
    else:
        out.append("0")
print("\n".join(out))
