import sys

data = sys.stdin.read().split()
n = int(data[0])
book = data[1:n + 1]              # 명부를 list 그대로 둔다
q = int(data[n + 1])
out = []
for name in data[n + 2:n + 2 + q]:
    if name in book:              # list의 in은 앞에서부터 하나씩 비교한다(질문마다 O(N))
        out.append("1")
    else:
        out.append("0")
print("\n".join(out))
