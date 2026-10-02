import sys
input = sys.stdin.readline

s = input().rstrip()
q = int(input())
arr = list(s)
count = 0
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
        count += 1

print("".join(arr))
print(count)
