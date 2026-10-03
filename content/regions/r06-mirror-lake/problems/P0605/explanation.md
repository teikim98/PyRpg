줄마다 '이름 하나 + 개수가 정해지지 않은 별점들'이니까 별표 언패킹이 딱이야.

- `name, *scores = input().split()`: 첫 값은 `name`, **나머지 전부**는 `scores` 리스트에 담겨. JS의 `const [name, ...scores] = line.split(" ")`과 같아.
- `scores`는 아직 문자열 리스트라서 `scores = list(map(int, scores))`로 정수로 바꿔. 그대로 `sum`하면 `TypeError`.
- `map(int, scores)`만 쓰면 리스트가 아니라 **한 번 꺼내면 비는** map 객체야. `sum`이 다 꺼내 가면 `max`에는 남는 게 없어서 `ValueError: max() iterable argument is empty`가 나. `list(...)`로 펼쳐 두자.
- `sum(scores)`, `max(scores)`: 내장 함수로 합계와 최고값을 바로 구해.
- 합계 최대는 '먼저 나온 사람'이니까 `total > best_total`일 때만 바꿔. 처음 값을 `-1`로 두면 합계가 0인 사람도 첫 사람으로 잡혀.
- `print(best_name, *best_scores)`: `*`로 리스트를 펼쳐서 `print(best_name, 5, 3, 8)`처럼 넘겨. `print(best_name, best_scores)`는 `[5, 3, 8]`을 그대로 찍어.
