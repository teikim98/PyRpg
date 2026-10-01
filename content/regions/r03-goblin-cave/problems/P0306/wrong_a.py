import sys
input = sys.stdin.readline

q = int(input())
roll = []
for _ in range(q):
    cmd = input().split()
    if cmd[0] == "add":
        roll.push(cmd[1])
    elif cmd[0] == "leave":
        roll.remove(cmd[1])
    else:
        roll.pop()
if len(roll) == 0:
    print("없음")
else:
    print(*roll)
