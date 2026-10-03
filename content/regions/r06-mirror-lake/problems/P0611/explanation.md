`n`장을 옮기는 일을 '`n - 1`장 옮기기' 두 번과 '가장 큰 연잎 한 번'으로 나누면 끝이야. 이게 하노이의 탑이고, 분할 재귀의 대표 문제야.

- `move_tower(n, start, end, via, moves)`: `start`의 `n`장을 `via`를 거쳐 `end`로 옮겨.
  1. 위의 `n - 1`장을 `via`로 비켜 둔다: `move_tower(n - 1, start, via, end, moves)`
  2. 가장 큰 연잎을 `end`로: `moves.append((start, end))`
  3. 비켜 둔 `n - 1`장을 `end`로 올린다: `move_tower(n - 1, via, end, start, moves)`
- **기저 조건** `if n == 0: return`: 옮길 연잎이 없으면 할 일이 없어. 이게 없으면 `n`이 `0`, `-1`, `-2`, … 로 끝없이 내려가서 `RecursionError`가 나.
- 이동 횟수를 **맨 먼저** 출력해야 하니까, 이동을 곧바로 `print`하지 말고 리스트 `moves`에 모아 뒀다가 `len(moves)`부터 출력해. 횟수만 따로 계산하면 `2 ** n - 1`이야(`2 ** n`이 아니야!).
- `for a, b in moves: print(a, b)`: 튜플을 두 변수로 풀어서 공백으로 출력. `print(*move)`도 같은 결과야.
- `n = 10`이면 이동이 1,023번이지만 재귀 깊이는 10뿐이라 안전해. 연잎이 한 장 늘 때마다 이동 횟수는 두 배쯤 늘어나.
