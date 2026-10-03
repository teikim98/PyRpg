# 부두 줄의 주문: deque

등대 앞 부두에는 배에 오르려는 사람들이 줄을 서 있어. 줄은 **앞에서 빼고 뒤에 넣는** 일이 많지. 가끔 급한 사람이 맨 앞에 끼어들기도 하고. 이런 줄을 다루는 도구가 `collections`의 **deque**(덱, 양쪽 끝이 열린 줄)야.

## 양쪽 끝에서 넣고 빼기

`append`/`pop`은 리스트처럼 **오른쪽 끝**, `appendleft`/`popleft`는 **왼쪽 끝**이야. 칸 번호로 읽기(`q[0]`, `q[-1]`)와 `len(q)`도 돼.

```python run
from collections import deque
q = deque(["ann", "bo"])
q.append("cy")            # 맨 뒤에 서기
q.appendleft("vip")       # 맨 앞에 끼어들기
print(list(q))            # ['vip', 'ann', 'bo', 'cy']
first = q.popleft()       # 맨 앞 빼기
last = q.pop()            # 맨 뒤 빼기
print(first, last)
print(q[0], q[-1], len(q))   # 맨 앞, 맨 뒤, 길이
```

```js compare
q.push("cy");          // ← Python: q.append("cy")
q.unshift("vip");      // ← Python: q.appendleft("vip")
q.shift();             // ← Python: q.popleft()
q.pop();               // 같아!
```

## 빈 줄에서 빼면 폭발

빈 deque에서 `popleft()`나 `pop()`을 하면 `IndexError: pop from an empty deque`가 나. 빼기 전에 줄이 비었는지 꼭 확인해. 빈 deque(빈 리스트, 빈 문자열도)는 `if` 조건에서 거짓이라서 `if q:`로 확인할 수 있어. 아래 블록은 에러 메시지만 보려고 `try`/`except`로 감쌌어.

```python run
from collections import deque
q = deque()
try:
    q.popleft()
except IndexError as e:
    print("IndexError:", e)
if q:
    print(q.popleft())
else:
    print(-1)             # 비었으면 정해진 값
print(len(q) == 0)
```

## 줄 돌리기: `rotate`

`q.rotate(k)`는 줄을 오른쪽으로 k칸 돌려. 맨 뒤 사람이 맨 앞으로 와. 음수면 왼쪽으로 돌아서 맨 앞 사람이 맨 뒤로 가. 원탁에 둘러앉은 것처럼 도는 문제에 좋아.

```python run
from collections import deque
q = deque([1, 2, 3, 4, 5])
q.rotate(1)
print(list(q))            # [5, 1, 2, 3, 4]
q.rotate(-2)
print(list(q))            # [2, 3, 4, 5, 1]
# 줄 서기 놀이: 맨 앞 사람을 빼서 맨 뒤로 보내기를 반복
seats = deque(["a", "b", "c"])
for _ in range(4):
    seats.append(seats.popleft())
print("".join(seats))
```

## 리스트로 하면 안 될까?

리스트도 `arr.pop(0)`으로 맨 앞을 뺄 수 있어(JS의 `shift`). 결과는 똑같아. 하지만 리스트는 맨 앞을 빼면 **뒤에 있는 값을 전부 한 칸씩 당겨야** 해. 줄이 10만 명이면 한 번 뺄 때마다 10만 칸을 옮기는 거지. deque는 양쪽 끝이 열려 있어서 몇 명이 서 있든 한 번에 끝나. 지금은 짧은 줄이라 차이가 안 보이지만, 나중에 큰 줄을 다루는 결계에서 이 차이가 승부를 가를 거야.

- 맨 앞에서 자주 빼면 `deque` + `popleft()`. `list.pop(0)`은 긴 줄에서 느려.
- 빼기 전엔 `if q:`로 비었는지 확인하기.

## 미니 연습

줄 맨 앞 사람을 빼서 `1`이 출력되도록 빈칸에 메서드 이름을 채워 봐.
