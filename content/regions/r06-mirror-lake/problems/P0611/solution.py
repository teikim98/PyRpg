import sys


def move_tower(n, start, end, via, moves):
    if n == 0:
        return
    move_tower(n - 1, start, via, end, moves)
    moves.append((start, end))
    move_tower(n - 1, via, end, start, moves)


n = int(sys.stdin.readline())
moves = []
move_tower(n, 1, 3, 2, moves)
print(len(moves))
for a, b in moves:
    print(a, b)
