# 자르기의 주문: 슬라이싱

갈림 굴의 박쥐들은 날개로 보물 줄을 **싹둑** 잘라 가. 우리도 줄의 일부분만 꺼내는 주문을 배우자. 이름하여 **슬라이싱**!

## `arr[시작:끝]`: 끝은 포함하지 않아

`arr[a:b]`는 칸 a부터 칸 b **바로 앞**까지 잘라서 **새 리스트**로 줘. `range`처럼 끝은 포함하지 않아.

```python run
shelf = [5, 3, 8, 1, 9, 2]
print(shelf[1:4])    # 칸 1, 2, 3 → [3, 8, 1]
print(shelf[:3])     # 처음부터 칸 2까지
print(shelf[3:])     # 칸 3부터 끝까지
print(shelf[-2:])    # 뒤에서 두 개
```

- 꺼낸 개수는 `끝 - 시작`이야. `shelf[1:4]`는 3개.
- 문제에서 "a번째부터 b번째까지(1부터 셈, 둘 다 포함)"라고 하면 `shelf[a - 1:b]`야. 시작은 1을 빼고, 끝은 그대로!

```js compare
shelf.slice(1, 4);   // [3, 8, 1]  ← 끝 미포함은 JS와 같아
// Python: shelf[1:4]
```

## 간격: `arr[시작:끝:간격]`

세 번째 칸은 걸음 간격이야. 간격이 음수면 **거꾸로** 걸어.

```python run
shelf = [5, 3, 8, 1, 9, 2]
print(shelf[::2])    # 하나 건너 하나: 칸 0, 2, 4
print(shelf[1::2])   # 칸 1, 3, 5
print(shelf[::-1])   # 거꾸로!
```

```js compare
[...shelf].reverse();   // JS는 복사 후 뒤집기
// Python: shelf[::-1]  ← 간격과 음수는 JS slice에 없는 기능
```

## 슬라이스는 새 리스트

슬라이스는 원래 리스트를 건드리지 않아. 그래서 `arr[:]`는 **통째 복사**가 돼.

```python run
original = [1, 2, 3]
alias = original        # 같은 리스트에 이름만 하나 더
copy = original[:]      # 새 리스트로 복사
original[0] = 99
print(alias)            # 같이 바뀜
print(copy)             # 그대로
```

> `alias = original`은 복사가 아니야. JS에서 `const b = a`가 같은 배열을 가리키는 것과 똑같아.

## 미니 연습

`arr`에서 `[2, 3, 4]`만 잘라 내도록 빈칸에 슬라이스를 채워 봐. 끝은 포함하지 않는다는 거, 기억하지?
