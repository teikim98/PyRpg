항구 이름 → 선원 리스트로 **묶는** 일이야. `defaultdict(list)`를 쓰면 처음 보는 항구도 알아서 빈 리스트로 시작해.

- `from collections import defaultdict`, `crew = defaultdict(list)`.
- `crew[port].append(name)`: 처음 보는 `port`면 `[]`가 생기고 거기에 이름이 들어가. 보통 dict `{}`에 이렇게 쓰면 처음 보는 항구에서 `KeyError`가 나.
- 보통 dict로 하려면 `append` 전에 `if port not in crew: crew[port] = []`를 해 둬야 해. 이 일을 `defaultdict`가 대신해 주는 거야.
- 항구는 `for port in sorted(crew):`로 사전순. dict는 넣은 순서를 기억하니까 `sorted` 없이 돌면 항구가 처음 나온 순서로 나와.
- 선원은 쪽지 순서 그대로니까 리스트를 정렬하지 않아. `" ".join(crew[port])`로 공백을 사이에 두고 이어.
- `print(port + ":", ...)`는 `print`가 값 사이에 공백 하나를 넣어 줘서 `east: dee`가 돼. f-string `f"{port}: {' '.join(crew[port])}"`도 같아.
