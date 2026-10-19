import sys

data = sys.stdin.read().split()   # 줄이 40만 개를 넘을 수 있으니 입력 전체를 한 번에 읽어 공백으로 나눈다
n = int(data[0])
book = set(data[1:n + 1])         # 명부는 반복 밖에서 set으로 한 번만 만든다
q = int(data[n + 1])
out = []
for name in data[n + 2:n + 2 + q]:
    if name in book:              # set의 in은 평균 O(1)
        out.append("1")
    else:
        out.append("0")
print("\n".join(out))
