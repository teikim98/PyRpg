질문이 양쪽 방향이니까 **장부를 두 권** 만들면 돼. 번호 → 이름, 이름 → 번호.

- 이름을 읽을 때 `name_of[i] = name`, `number_of[name] = i`로 두 장부에 한꺼번에 적어. 번호는 1부터니까 `range(1, n + 1)`.
- 질문은 `q.isdigit()`으로 숫자인지 확인해. 숫자면 `name_of[int(q)]`, 아니면 `number_of[q]`.
- 번호를 `int(q)`로 바꾸지 않고 `name_of[q]`로 찾으면, 키 `2`(정수)와 `"2"`(문자열)는 다른 키라서 `KeyError: '2'`가 나.
- 이름을 리스트에 담아 `names[int(q)]`로 찾으면 칸 번호가 0부터라서 한 칸씩 밀리고, N번에서는 `IndexError`가 나. 리스트라면 `names[int(q) - 1]`.
- `sys.stdin.readline()`으로 읽은 줄 끝의 `\n`을 `rstrip()`으로 떼지 않으면 `"3\n".isdigit()`이 거짓이 되고, 키에도 줄바꿈이 섞여서 엉망이 돼.
- 이름 → 번호를 `names.index(q) + 1`로 찾아도 답은 맞지만, 명부가 길면 질문마다 처음부터 뒤져. dict는 바로 찾아.
