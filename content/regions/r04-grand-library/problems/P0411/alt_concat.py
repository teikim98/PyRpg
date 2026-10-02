import sys
input = sys.stdin.readline

s = input().rstrip()
q = int(input())
arr = list(s)
for _ in range(q):
    cmd = input().split()
    if cmd[0] == "SET":
        arr[int(cmd[1]) - 1] = cmd[2]
    elif cmd[0] == "SWAP":
        i = int(cmd[1]) - 1
        j = int(cmd[2]) - 1
        arr[i], arr[j] = arr[j], arr[i]
    else:
        i = int(cmd[1]) - 1
        arr[i] = arr[i].upper()

out = ""
count = 0
for c in arr:
    out += c
    if c.isupper():
        count += 1
print(out)
print(count)
