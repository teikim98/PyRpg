# 펼침의 주문: 언패킹과 내장 함수

버드나무 둑에서는 값이 우르르 몰려와. 한 줄에 이름과 점수 여러 개, 물 위와 물속에 비친 두 줄. 이걸 하나씩 꺼내 쓰는 대신 한 번에 **나눠 담고**, 한 번에 **펼치고**, 두 줄을 **짝지어** 도는 주문들이 있어. JS의 스프레드 `...`와 구조 분해를 떠올리면 금방이야.

## `*`로 모으고, `*`로 펼치기

`a, b = ...`처럼 나눠 담을 때 한 변수 앞에 `*`를 붙이면 **남는 값을 전부 리스트로** 모아 줘. 반대로 함수를 부를 때 리스트 앞에 `*`를 붙이면 값을 하나하나 **펼쳐서** 넘겨. `print(*arr)`가 공백으로 띄워 한 줄에 찍는 것도 이 덕분이야.

```python run
arr = [5, 3, 8, 1]
first, *rest = arr
print(first, rest)          # 5 [3, 8, 1]
*init, last = arr
print(init, last)           # [5, 3, 8] 1
line = "bo 70 85 90"        # 입력으로 읽은 한 줄이라고 치고
name, *scores = line.split()
print(name, scores)         # 모은 값은 언제나 리스트(아직 문자열!)
print(*arr)                 # 5 3 8 1  (펼쳐서 넘김)
print(*arr, sep=",")        # 5,3,8,1

def area(w, h):
    return w * h
size = [3, 4]
print(area(*size))          # area(3, 4)와 같아
```

```js compare
const [first, ...rest] = arr;   // ← Python: first, *rest = arr
console.log(...arr);            // ← Python: print(*arr)
area(...size);                  // ← Python: area(*size)
```

## 번호 붙이기 `enumerate`, 짝짓기 `zip`

`enumerate(arr)`는 `(번호, 값)` 쌍을 하나씩 줘. 번호를 1부터 세고 싶으면 `enumerate(arr, 1)`. `zip(a, b)`는 두 리스트의 같은 칸끼리 `(a의 값, b의 값)`으로 짝지어 주는데, 길이가 다르면 **짧은 쪽에 맞춰** 멈춰.

```python run
stones = ["moss", "dry", "moss"]
for i, s in enumerate(stones, 1):    # 1부터 번호를 붙여 줌
    print(i, s)
above = [3, 5, 2]
below = [3, 4, 2, 9]                 # 하나 더 길어도
for a, b in zip(above, below):       # 짧은 쪽(3개)에 맞춰 멈춤
    print(a, b, a == b)
print(list(zip(above, below)))
```

```js compare
for (const [i, s] of arr.entries()) {}   // ← Python: for i, s in enumerate(arr):
// JS에는 내장 zip이 없어서 a.map((x, i) => [x, b[i]])처럼 직접 만들어
```

## `map`의 정체: 한 번 쓰면 끝나는 지연 객체

`map(int, 문자열들)`은 리스트가 아니라 **map 객체**를 돌려줘. 값을 미리 다 만들어 두지 않고, 꺼낼 때마다 하나씩 만드는 '지연' 객체야. 그래서 `m[0]`처럼 칸 번호로 읽거나 `len(m)`을 쓸 수 없고, 한 번 끝까지 꺼내면 비어 버려. 리스트로 쓰고 싶으면 `list(...)`로 펼쳐 둬. `zip`과 `enumerate`도 같은 성질이야.

```python run
m = map(int, "4 7 1".split())
print(type(m))                # <class 'map'>: 아직 리스트가 아님
nums = list(m)                # list()로 펼쳐야 리스트
print(nums)
print(list(m))                # [] : map은 한 번 꺼내 쓰면 끝
a, b, c = map(int, "4 7 1".split())   # 바로 나눠 담는 건 OK
print(a + b + c)
z = zip([1, 2], ["a", "b"])
print(list(z), list(z))       # 두 번째는 빈 리스트
```

- `print(map(int, arr))`처럼 그대로 찍으면 값 대신 `<map object at 0x...>`가 나와. `print(*map(...))`나 `list(...)`로 펼쳐.
- `zip` 결과를 두 번 돌아야 하면 처음부터 `pairs = list(zip(a, b))`로 담아 두자.

## 한 번에 계산하는 내장 함수

`sum`, `min`, `max`는 리스트를 통째로 받아. `any`는 하나라도 참이면 `True`, `all`은 전부 참이어야 `True`. `max`와 `min`에는 `key=`로 '무엇으로 비교할지'를 줄 수 있어(다음 비석에서 자세히).

```python run
depths = [4, 9, 2, 7]
print(sum(depths), min(depths), max(depths))
print(sum(depths) / len(depths))          # 평균
print(any([d > 8 for d in depths]))       # 8보다 깊은 곳이 하나라도?
print(all([d > 1 for d in depths]))       # 전부 1보다 깊은가?
print(max(3, 8, 5))                       # 값을 여러 개 바로 줘도 돼
words = ["reed", "lily", "willow"]
print(max(words, key=len))                # 가장 긴 단어
```

```js compare
arr.reduce((s, x) => s + x, 0);   // ← Python: sum(arr)
Math.max(...arr);                 // ← Python: max(arr)
arr.some((d) => d > 8);           // ← Python: any([d > 8 for d in arr])
arr.every((d) => d > 1);          // ← Python: all([d > 1 for d in arr])
```

## 미니 연습

두 리스트를 같은 칸끼리 짝지어서 `ann 12`, `bo 9`가 한 줄씩 출력되게 빈칸에 내장 함수 이름을 채워 봐.
