import sys
input = sys.stdin.readline

s = input().rstrip()
q = int(input())
for _ in range(q):
    cmd = input().split()
    if cmd[0] == "SET":
        s[int(cmd[1]) - 1] = cmd[2]
    elif cmd[0] == "SWAP":
        i = int(cmd[1]) - 1
        j = int(cmd[2]) - 1
        s[i], s[j] = s[j], s[i]
    else:
        i = int(cmd[1]) - 1
        s[i] = s[i].upper()

count = 0
for c in s:
    if c.isupper():
        count += 1
print(s)
print(count)
