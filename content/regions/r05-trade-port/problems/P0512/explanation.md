양쪽 끝에서 넣고 빼는 줄은 `deque`가 딱이야. 명령 이름을 보고 알맞은 메서드를 부르면 돼.

- 맨 뒤: `append(x)`로 넣고 `pop()`으로 빼. 맨 앞: `appendleft(x)`로 넣고 `popleft()`로 빼. 거꾸로 짝지으면 엉뚱한 쪽에서 빠져.
- 맨 앞 번호는 `q[0]`, 맨 뒤 번호는 `q[-1]`, 사람 수는 `len(q)`.
- 빈 deque에서 `popleft()`나 `pop()`을 하면 `IndexError: pop from an empty deque`, `q[0]`은 `IndexError: deque index out of range`야. 그래서 빼거나 읽기 전에 `if q:`로 줄이 비었는지 먼저 확인해.
- `empty`는 `1`/`0`을 출력해야 해. `print(len(q) == 0)`은 `True`/`False`를 찍어 버려.
- 번호표는 계산할 일이 없으니 `cmd[1]` 문자열 그대로 넣어도 돼. 출력하면 숫자와 똑같이 보여.
- 리스트로 해도 답은 맞지만 맨 앞에 넣고 빼는 `insert(0, x)`, `pop(0)`은 줄이 길수록 느려져. deque는 양쪽 끝 모두 바로 끝나.
