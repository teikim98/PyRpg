import sys
input = sys.stdin.readline

s = input().rstrip()
q = int(input())
for _ in range(q):
    cmd = input().split()
    if cmd[0] == "SET":
        i = int(cmd[1]) - 1
        s = s[:i] + cmd[2] + s[i + 1:]
    elif cmd[0] == "SWAP":
        i = int(cmd[1]) - 1
        j = int(cmd[2]) - 1
        a = s[i]
        b = s[j]
        s = s[:i] + b + s[i + 1:]
        s = s[:j] + a + s[j + 1:]
    else:
        i = int(cmd[1]) - 1
        s = s[:i] + s[i].upper() + s[i + 1:]

count = 0
for c in s:
    if c.isupper():
        count += 1
print(s)
print(count)
