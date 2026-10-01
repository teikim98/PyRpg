import sys
input = sys.stdin.readline

q = int(input())
roll = []
for _ in range(q):
    cmd = input().split()
    if cmd[0] == "add":
        roll.append(cmd[1])
    elif cmd[0] == "leave":
        while cmd[1] in roll:
            roll.remove(cmd[1])
    else:
        roll.pop()
if len(roll) == 0:
    print("없음")
else:
    print(*roll)
