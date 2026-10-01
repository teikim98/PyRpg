# 한 줄 주문: 리스트 컴프리헨션

거울 웅덩이에 비친 보석들 좀 봐. 웅덩이는 리스트를 비춰서 **새 리스트**를 만들어 내. 반복문 네 줄을 한 줄로 줄이는 주문, **리스트 컴프리헨션**이야!

## `for x in arr`: 값을 바로 꺼내기

리스트는 `range` 없이 바로 돌 수 있어. 칸 번호가 필요할 때만 `range(len(arr))`.

```python run
gems = [4, 7, 2]
for g in gems:                 # 값을 하나씩
    print(g, end=" ")
print()
for i in range(len(gems)):     # 칸 번호가 필요할 때
    print(i, gems[i])
for i, g in enumerate(gems):   # 번호와 값을 함께(맛보기)
    print(i, g)
```

```js compare
for (const g of gems) { }                  // Python: for g in gems:
gems.forEach((g, i) => { });               // Python: for i, g in enumerate(gems):
```

## 컴프리헨션: `[식 for 변수 in 리스트]`

```python run
gems = [4, 7, 2]
doubled = [g * 2 for g in gems]
print(doubled)
squares = [i * i for i in range(1, 6)]
print(squares)
```

읽는 법: "gems의 각 g에 대해, `g * 2`를 담아라." 아래 반복문과 똑같아.

```python run
gems = [4, 7, 2]
doubled = []
for g in gems:
    doubled.append(g * 2)
print(doubled)
```

```js compare
gems.map(g => g * 2);    // Python: [g * 2 for g in gems]
```

## 조건 붙이기: `if`

끝에 `if 조건`을 붙이면 조건이 참인 것만 담아. JS의 `filter`야.

```python run
gems = [1, 2, 3, 4, 5, 6, -4]
evens = [g for g in gems if g % 2 == 0]
print(evens)
big_doubled = [g * 2 for g in gems if g > 3]
print(big_doubled)
```

```js compare
gems.filter(g => g % 2 === 0);              // Python: [g for g in gems if g % 2 == 0]
gems.filter(g => g > 3).map(g => g * 2);    // Python: [g * 2 for g in gems if g > 3]
```

> 돌고 있는 리스트에서 `remove`로 지우면 바로 다음 원소를 건너뛰어. 거르고 싶을 땐 지우지 말고 컴프리헨션으로 **새 리스트**를 만들자.

## 미니 연습

`arr`에서 짝수만 골라 제곱한 리스트 `[4, 16]`이 나오도록 빈칸에 조건을 채워 봐.
