리스트 메서드 세 개로 출석부를 다뤄: 넣기는 `append`, 이름으로 지우기는 `remove`, 맨 뒤 지우기는 `pop`.

- `roll.append(x)`는 맨 뒤에 하나 넣어. JS의 `push`가 Python에서는 `append`야. `roll.push`라고 쓰면 리스트에 그런 기능이 없어서 `AttributeError`.
- `roll.remove(x)`는 x와 같은 값 중 **가장 앞의 하나만** 지워. 없는 값을 지우려 하면 `ValueError`가 나는데, 이 문제는 있는 이름만 주니까 괜찮아.
- `roll.pop()`은 맨 뒤를 꺼내서(지우고) 돌려줘. `roll.pop(0)`처럼 칸 번호를 주면 그 칸을 꺼내.
- 명령 한 줄은 `input().split()`으로 `['add', 'gob']`처럼 자르면 첫 칸이 명령, 둘째 칸이 이름이야. `last`는 한 칸뿐이라 `cmd[1]`을 읽으면 안 돼. 그래서 `else`에서 처리했어.
- 비어 있는지는 `len(roll) == 0`으로 확인해. (빈 리스트는 조건에서 거짓이라 `if not roll:`이라고 써도 돼.)
