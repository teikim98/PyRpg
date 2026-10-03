같은 자리끼리 짝짓는 일은 `zip`이 제일 잘해.

- `zip(real, shadow)`: `(real[0], shadow[0])`, `(real[1], shadow[1])`, …를 차례로 만들어 줘. 두 리스트 길이가 다르면 **짧은 쪽에서 멈춰서**, 이 문제의 '둘 다 있는 칸까지만'이 저절로 지켜져. JS에는 내장 `zip`이 없어서 인덱스로 돌곤 하지.
- `for i in range(len(real)):`로 돌면 그림자 줄이 더 짧을 때 `shadow[i]`에서 `IndexError`가 나.
- `diffs = [a - b for a, b in zip(real, shadow)]`: 쌍을 `a`, `b`로 풀어서 바로 빼(언패킹).
- `zip(...)`은 한 번 돌면 비는 꾸러미야. `pairs = zip(...)`에 담아 두고 두 번 돌면 두 번째는 아무것도 안 나와. 다시 쓸 거면 `list(zip(...))`로 담거나, 이미 만든 `diffs`를 써.
- `print(*diffs)`: 리스트를 펼쳐서 공백으로 구분해 출력. `print(diffs)`는 `[0, -1, 2, 0]` 모양 그대로 찍혀.
- `sum(1 for d in diffs if d != 0)`은 조건에 맞는 칸마다 1을 더해서 개수를 세는 방법이야. `len([d for d in diffs if d != 0])`도 같아.
