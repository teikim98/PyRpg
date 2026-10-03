# 줄 세움의 주문: lambda와 정렬

거울 다리의 쌍둥이는 무엇이든 정해진 순서로 줄 세워야 길을 내준대. 그냥 크기순이 아니라 '점수 큰 순, 같으면 이름순'처럼 규칙이 여러 겹이야. 이런 줄 세우기를 한 줄로 해내는 도구가 `sorted`의 **`key`**와 이름 없는 작은 함수 **`lambda`**야.

## `lambda`와 `key`

`lambda 매개변수: 식`은 `return`이 붙은 한 줄짜리 함수야. 이름을 붙일 필요도 없을 만큼 짧은 함수를 그 자리에서 만들 때 써. `sorted(arr, key=함수)`는 각 값에 그 함수를 적용한 결과로 비교해. **key는 '무엇으로 비교할지'**를 알려 주는 함수야.

```python run
double = lambda x: x * 2          # 이름 없는 한 줄 함수
print(double(5))                   # 10
def double2(x):                    # 위와 똑같은 일
    return x * 2
print(double2(5))
words = ["willow", "fig", "alder", "reed"]
print(sorted(words))               # 사전순(기본): alder, fig, reed, willow
print(sorted(words, key=len))      # 길이순: fig, reed, alder, willow
print(sorted(words, key=lambda w: w[-1]))   # 마지막 글자순: reed, fig, alder, willow
```

## `sorted`와 `.sort()`는 달라

`sorted(arr)`는 정렬된 **새 리스트**를 돌려주고 `arr`는 그대로 둬. `arr.sort()`는 `arr` 자체를 **제자리에서** 정렬하고 **`None`**을 돌려줘. 그래서 `arr = arr.sort()`라고 쓰면 리스트가 사라져! 큰 것부터 세우려면 둘 다 `reverse=True`.

```python run
arr = [3, 1, 2]
new = sorted(arr)          # 새 리스트, arr는 그대로
print(new, arr)            # [1, 2, 3] [3, 1, 2]
arr.sort()                 # arr 자체를 정렬
print(arr)                 # [1, 2, 3]
oops = arr.sort()          # sort()가 돌려주는 건 None!
print(oops)                # None
print(sorted([3, 1, 2], reverse=True))   # [3, 2, 1]
```

```js compare
[10, 9, 1].sort();                   // [1, 10, 9]!  JS 기본 정렬은 문자열로 비교
[10, 9, 1].sort((a, b) => a - b);    // ← Python: sorted([10, 9, 1])  (숫자는 숫자로 비교)
arr.sort((a, b) => b - a);           // ← Python: arr.sort(reverse=True)
boats.sort((a, b) => a[1] - b[1]);   // ← Python: boats.sort(key=lambda b: b[1])
// JS sort는 정렬한 배열을 돌려주지만, Python의 arr.sort()는 None을 돌려줘
```

JS는 두 값을 받아 비교하는 함수를 주지만, Python은 값 **하나**를 받아 '비교할 값'을 돌려주는 key 함수를 줘. `key=lambda a, b: a - b`처럼 JS식으로 쓰면 `missing 1 required positional argument` 에러가 나.

## 여러 겹 규칙: 튜플 key와 `-` 트릭

튜플끼리는 **앞 칸부터** 비교하고, 앞 칸이 같을 때만 다음 칸을 봐. 그래서 key가 튜플을 돌려주면 '첫째 기준, 같으면 둘째 기준'이 돼. 숫자 기준을 **큰 순**으로 하고 싶으면 그 칸에만 `-`를 붙여. `reverse=True`는 **모든 칸을 한꺼번에** 뒤집으니까 조심!

```python run
boats = [("ann", 3), ("bo", 5), ("cy", 3), ("di", 5)]
print((5, "a") < (5, "b"), (3, "z") < (4, "a"))   # True True: 앞 칸부터 비교
# 점수 큰 순, 점수가 같으면 이름 사전순
print(sorted(boats, key=lambda b: (-b[1], b[0])))
# reverse=True는 이름 순서까지 뒤집어 버려(di가 bo보다 앞에!)
print(sorted(boats, key=lambda b: (b[1], b[0]), reverse=True))
```

## 문자열에는 `-`가 안 돼: 두 번 정렬

`-`는 숫자에만 붙일 수 있어. 이름을 **사전 역순**으로 세우고 싶다고 `-name`을 쓰면 `TypeError`가 나. 이럴 땐 Python 정렬이 **안정 정렬**(비교 값이 같은 것끼리는 원래 순서를 지킴)이라는 걸 이용해. **덜 중요한 기준으로 먼저** 정렬하고, **더 중요한 기준으로 나중에** 한 번 더 정렬하면 돼. 아래 블록은 에러 메시지만 보려고 `try`/`except`로 감쌌어.

```python run
try:
    print(-"bo")
except TypeError as e:
    print("TypeError:", e)
boats = [("ann", 3), ("bo", 5), ("cy", 3), ("di", 5)]
# 점수 작은 순, 점수가 같으면 이름 사전 '역순'
step1 = sorted(boats, key=lambda b: b[0], reverse=True)   # 덜 중요한 기준 먼저
step2 = sorted(step1, key=lambda b: b[1])                 # 중요한 기준을 나중에
print(step2)
```

## `min`/`max`에도 `key`

가장 큰 것 하나만 필요하면 정렬할 필요 없이 `max(arr, key=...)`. 비교 값이 같은 게 여럿이면 **먼저 나온 것**을 돌려줘.

```python run
boats = [("ann", 3), ("bo", 5), ("cy", 3)]
print(max(boats, key=lambda b: b[1]))   # ('bo', 5): 점수가 가장 큰 배
print(min(boats, key=lambda b: b[1]))   # ('ann', 3): 동률이면 먼저 나온 것
words = ["reed", "lily", "willow"]
print(min(words, key=len))              # reed
```

- 새 리스트가 필요하면 `sorted(...)`, 제자리면 `arr.sort()` 한 줄만. `arr.sort()`의 결과를 변수에 담거나 출력하지 않기.
- 여러 기준은 튜플 key. 숫자는 `-`로 뒤집고, 문자열은 두 번 정렬.

## 미니 연습

배를 점수 큰 순으로, 점수가 같으면 이름 사전순으로 세우도록 빈칸에 첫째 기준을 채워 봐.
