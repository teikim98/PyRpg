# 보물 정리의 주문: 리스트 메서드

보물 창고는 고블린 서기가 관리해. 넣고, 빼고, 세고, 줄 세우고… 리스트에는 이런 일을 하는 **메서드**가 잔뜩 붙어 있어.

## 넣기와 빼기

```python run
roll = ["gob", "lin"]
roll.append("kiki")      # 맨 뒤에 넣기
roll.insert(0, "zz")     # 칸 0에 끼워 넣기
print(roll)
roll.remove("lin")       # 같은 값 중 맨 앞의 하나를 지우기
last = roll.pop()        # 맨 뒤를 꺼내기(지우고 돌려줌)
print(last, roll)
first = roll.pop(0)      # 칸 0을 꺼내기
print(first, roll)
```

```js compare
roll.push("kiki");       // Python: roll.append("kiki")
roll.splice(0, 0, "zz"); // Python: roll.insert(0, "zz")
roll.pop();              // 같아!
roll.shift();            // Python: roll.pop(0)
```

> JS 습관대로 `roll.push(...)`라고 쓰면 `AttributeError`가 나. Python에서는 `append`!

## 찾기와 세기, 합·최댓값·최솟값

```python run
coins = [3, 10, 7, 3, 2]
print(coins.index(7))    # 7이 처음 나오는 칸 번호
print(coins.count(3))    # 3이 몇 개?
print(sum(coins), max(coins), min(coins))
```

## `sort()`와 `sorted()`: 제자리냐, 새 리스트냐

둘 다 정렬하지만 결과를 돌려주는 방식이 달라. 여기가 이 동굴에서 제일 많이 넘어지는 곳이야!

```python run
a = [10, 9, 1]
b = sorted(a)            # 정렬된 새 리스트, a는 그대로
print(a, b)
a.sort()                 # a를 제자리에서 정렬, 돌려주는 값은 None
print(a)
result = a.sort()
print(result)            # None!
a.reverse()              # 제자리 뒤집기도 None을 돌려줘
print(a)
```

- `arr = arr.sort()`라고 쓰면 정렬은 되지만 `arr`에 `None`이 들어가서 리스트를 잃어버려.
- 새 리스트가 필요하면 `sorted(arr)`, 원래 리스트를 바꾸면 되면 `arr.sort()`만 한 줄에.
- 큰 것부터는 `sorted(arr, reverse=True)`.

```js compare
[10, 9, 1].sort();       // [1, 10, 9]  ← JS는 기본이 문자열 순서!
[10, 9, 1].sort((a, b) => a - b);  // 숫자로 정렬하려면 비교 함수가 필요
// Python: sorted([10, 9, 1]) → [1, 9, 10]  숫자는 숫자로 정렬
```

## 미니 연습

빈칸에 한 줄을 넣어서 `arr` 자체를 정렬해 봐. 출력은 `[1, 2, 3]`이 나와야 해.
