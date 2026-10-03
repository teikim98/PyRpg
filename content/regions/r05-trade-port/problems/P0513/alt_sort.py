import sys
input = sys.stdin.readline

n = int(input())
cargo = sorted(input().split())
# 정렬하면 같은 이름이 붙어 있으니 묶음마다 길이를 센다
count = {}
best = ""
best_count = 0
i = 0
while i < n:
    j = i
    while j < n and cargo[j] == cargo[i]:
        j += 1
    count[cargo[i]] = j - i
    if j - i > best_count:      # 사전순으로 돌기 때문에 동률이면 앞선 이름이 남는다
        best = cargo[i]
        best_count = j - i
    i = j
q = int(input())
out = []
for _ in range(q):
    out.append(str(count.get(input().rstrip(), 0)))
out.append(best)
print("\n".join(out))
