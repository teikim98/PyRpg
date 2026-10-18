# 묶음의 주문: 튜플

항구의 상인들은 물건을 늘 묶어서 다뤄. (품목, 값), (x 좌표, y 좌표)처럼 함께 다녀야 하는 값들. 이렇게 값 몇 개를 한 덩어리로 묶은 게 **튜플**(`tuple`)이야. 리스트처럼 생겼는데 괄호가 둥글어.

## 튜플 만들기와 꺼내기

괄호 `()` 안에 쉼표로 값을 늘어놓으면 튜플이야. 꺼내는 법은 리스트와 똑같아. 칸 번호는 0부터, `len()`도 되고 `in`도 돼.

```python run
point = (3, 7)
item = ("salt", 30)
print(point[0], point[1])    # 3 7
print(item[-1])              # 맨 끝: 30
print(len(item))             # 2
print("salt" in item)        # True
one = (5,)                   # 값이 하나면 쉼표가 꼭 필요해
print(type(one), type((5)))  # (5)는 그냥 괄호 친 숫자
```

## 튜플은 고칠 수 없어(불변)

문자열처럼 튜플도 **만든 뒤에 칸을 바꿀 수 없어**. 그래서 '절대 바뀌면 안 되는 묶음'을 담기에 좋아. 아래 블록은 에러 메시지만 보려고 `try`/`except`로 감쌌어.

```python run
point = (3, 7)
try:
    point[0] = 10
except TypeError as e:
    print("TypeError:", e)
point = (10, point[1])       # 바꾸고 싶으면 새 튜플을 만든다
print(point)
```

```js compare
const point = Object.freeze([3, 7]);
point[0] = 10;      // 엄격 모드가 아니면 조용히 무시돼
// Python 튜플은 언제나 TypeError로 알려 줘
```

## 풀기(언패킹)와 맞바꾸기

튜플의 값을 변수 여러 개에 한 번에 나눠 담을 수 있어. 이걸 **언패킹**이라고 해. 지역 1에서 쓴 `a, b = map(int, input().split())`도 사실 이거였어! 그리고 이걸 쓰면 임시 변수 없이 두 값을 **맞바꿀** 수 있어.

```python run
point = (3, 7)
x, y = point                 # x = 3, y = 7
print(x, y)
a, b = 1, 2                  # 오른쪽 1, 2도 괄호만 생략한 튜플
a, b = b, a                  # 맞바꾸기!
print(a, b)                  # 2 1
pairs = [("salt", 30), ("rope", 12), ("tea", 45)]
for name, price in pairs:    # 꺼내면서 바로 풀기
    print(name, price)
```

```js compare
const [x, y] = point;        // 구조 분해 ← Python: x, y = point
[a, b] = [b, a];             // ← Python: a, b = b, a
for (const [name, price] of pairs) { }  // ← Python: for name, price in pairs:
```

> `a = b` 다음 `b = a`로 맞바꾸면 안 돼! 첫 줄에서 `a`의 원래 값이 사라져서 둘 다 `b`가 돼. `a, b = b, a`는 오른쪽을 먼저 다 묶어 두고 나눠 담으니까 안전해.

## 여러 값 돌려주기

함수가 `return lo, hi`처럼 쉼표로 값을 늘어놓으면 튜플 하나를 돌려주는 거야. 받는 쪽에서 바로 풀면 돼. `def`로 함수를 만드는 법은 거울 호수에서 자세히 배워. 지금은 `def solution(...)` 틀에서 봐 온 그대로, `return` 뒤에 쓴 값이 함수를 부른 곳으로 돌아간다는 것만 알면 돼.

```python run
def cheapest_and_dearest(prices):
    lo = prices[0]
    hi = prices[0]
    for p in prices:
        if p < lo:
            lo = p
        if p > hi:
            hi = p
    return lo, hi            # (lo, hi) 튜플

result = cheapest_and_dearest([30, 12, 45, 20])
print(result)                # (12, 45)
lo, hi = cheapest_and_dearest([5, 9])
print(lo, hi)
```

## 튜플끼리 비교하기

튜플은 **앞 칸부터 차례로** 비교해. 앞 칸이 같으면 다음 칸으로 넘어가. 그래서 `(값, 이름)` 튜플로 정렬하면 값 순서, 값이 같으면 이름 순서가 돼.

```python run
print((1, "b") < (2, "a"))   # 앞 칸 1 < 2 → True
print((2, "a") < (2, "b"))   # 앞 칸이 같으니 "a" < "b" → True
goods = [(30, "salt"), (12, "rope"), (30, "fish")]
print(sorted(goods))         # 값 순서, 같으면 이름 순서
```

- 묶음은 `(a, b)`, 하나짜리는 `(a,)`. 칸 번호로 읽기는 되지만 바꾸기는 안 돼.
- `x, y = point`로 풀기, `a, b = b, a`로 맞바꾸기, `return lo, hi`로 여러 값 돌려주기.

## 미니 연습

`a`와 `b`를 맞바꿔서 `2 1`이 출력되도록 빈칸을 채워 봐.
