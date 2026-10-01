# 격자의 주문: 2차원 리스트

벽화의 방 벽이 바둑판처럼 나뉘어 있어. 칸마다 숫자가 새겨져 있고. 리스트 안에 리스트를 넣으면 이런 **격자**를 표현할 수 있어. 2차원 리스트!

## 만들고 읽기: `grid[줄][칸]`

```python run
grid = [
    [1, 2, 3],
    [4, 5, 6],
]
print(grid[0])       # 0번 줄 전체
print(grid[1][2])    # 1번 줄의 2번 칸 → 6
print(len(grid), len(grid[0]))   # 줄 수, 한 줄의 칸 수
for row in grid:
    print(*row)      # 줄마다 공백으로 출력
```

## n줄 m칸짜리 빈 격자 만들기

정해진 크기의 격자는 **컴프리헨션**으로 만들어. 줄마다 새 리스트가 생겨.

```python run
n, m = 3, 4
board = [[0] * m for _ in range(n)]
board[1][2] = 7
for row in board:
    print(*row)
```

## 조심! `[[0] * m] * n`의 함정

짧아 보여서 이렇게 쓰고 싶어지는데, 이건 **같은 줄 하나를 n번 가리키는** 리스트야. 한 칸을 바꾸면 모든 줄이 같이 바뀌어.

```python run
n, m = 3, 4
trap = [[0] * m] * n
trap[1][2] = 7
for row in trap:
    print(*row)      # 세 줄 모두 7이 생겨 버림!
```

```js compare
const trap = Array(3).fill([]);   // 같은 배열 하나를 세 칸이 나눠 씀
trap[0].push(7);                  // 세 줄 모두 [7]
// 안전하게: Array.from({ length: 3 }, () => [])
// Python: [[0] * m for _ in range(n)]
```

> `[0] * m`처럼 **숫자**를 곱하는 건 괜찮아. 리스트를 곱해서 줄을 늘리는 게 문제야.

## 줄 순서로, 칸 순서로

바깥 반복이 줄이면 가로로 읽고, 바깥 반복이 칸(열)이면 세로로 읽어.

```python run
grid = [[1, 2, 3], [4, 5, 6]]
for r in range(len(grid)):           # 가로 읽기
    for c in range(len(grid[0])):
        print(grid[r][c], end=" ")
print()
for c in range(len(grid[0])):        # 세로 읽기
    for r in range(len(grid)):
        print(grid[r][c], end=" ")
print()
```

## 미니 연습

2줄 3칸짜리 격자에서 **아래 줄의 마지막 칸**에 7을 넣어 봐. 줄 번호도 0부터야!
