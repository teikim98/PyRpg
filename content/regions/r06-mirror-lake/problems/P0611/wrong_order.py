import sys


def move_tower(n, start, end, via):
    if n == 0:
        return
    move_tower(n - 1, start, via, end)
    print(start, end)
    move_tower(n - 1, via, end, start)


n = int(sys.stdin.readline())
move_tower(n, 1, 3, 2)
print(2 ** n - 1)
