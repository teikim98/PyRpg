# 엮고 푸는 주문: split, join, f-string

서고 미로의 책들은 단어 순서가 뒤죽박죽이야. 문장을 단어로 **풀고**(`split`), 정리한 다음 다시 문장으로 **엮는**(`join`) 주문을 배워 보자. 그리고 글자를 예쁘게 줄 세우는 f-string 서식까지!

## split: 풀기

- `s.split()`: 공백(여러 칸이어도, 줄바꿈이어도)을 기준으로 잘라서 **문자열 리스트**를 만들어. 빈 조각은 생기지 않아.
- `s.split(",")`: 쉼표처럼 정해 준 구분자로 잘라. 구분자가 붙어 있으면 빈 문자열 `""` 조각이 생겨.

```python run
line = "time   stops  here"
print(line.split())          # 공백이 몇 칸이든 OK
print(line.split(" "))       # 한 칸씩 자르면 빈 조각이 생김
print("a,b,,c".split(","))
```

## join: 엮기

`"구분자".join(리스트)`는 리스트의 문자열들을 구분자로 이어 붙여. JS의 `arr.join(" ")`과 **주어와 인자가 반대**야. 구분자가 앞에 와!

```python run
words = ["here", "stops", "time"]
print(" ".join(words))
print("-".join(words))
print("".join(["a", "b", "c"]))     # 구분자 없이 붙이기
nums = [3, 1, 4]
print(" ".join(map(str, nums)))     # 숫자는 str로 바꿔서
print(*nums)                         # 출력만 할 거면 이것도 OK
```

```js compare
words.join(" ");          // ← Python: " ".join(words)
[3, 1, 4].join(" ");      // JS는 숫자도 알아서 문자열로
// Python은 " ".join([3, 1, 4])면 TypeError → " ".join(map(str, nums))
```

> `" ".join([3, 1, 4])`는 `TypeError: sequence item 0: expected str instance, int found`야. join은 **문자열 리스트**만 엮어.

## 글자 고치기: list로 풀고 join으로 엮기

글자 읽기의 주문에서 문자열은 칸을 바꿀 수 없다고 했지? 글자를 여러 번 고쳐야 할 땐 `list(s)`로 글자 리스트를 만들고, 리스트는 마음대로 고친 다음, 마지막에 `"".join`으로 다시 엮어.

```python run
s = "bnok"
arr = list(s)              # ['b', 'n', 'o', 'k']
arr[1] = "o"               # 리스트는 칸을 바꿀 수 있어
arr[0] = arr[0].upper()
print(arr)
s = "".join(arr)
print(s)                   # Book
```

리스트 두 칸을 **맞바꾸는** 것도 한 줄이면 돼. 고블린 동굴에서 본 `n, m = 3, 4`와 같은 모양이야. 파이썬은 `=` 오른쪽을 먼저 다 계산해 두고, 그 값들을 왼쪽 칸에 차례로 나눠 담아. 그래서 한쪽 값이 덮여서 사라질 걱정이 없어.

```python run
arr = list("dog")
arr[0], arr[2] = arr[2], arr[0]    # 오른쪽 ('g', 'd')을 먼저 계산 → 0번 칸에 'g', 2번 칸에 'd'
print(arr)                         # ['g', 'o', 'd']
print("".join(arr))                # god
```

> 매번 `s = s[:i] + c + s[i + 1:]`로 새 문자열을 만들면 한 글자 고칠 때마다 문자열 전체를 베껴 써. 고칠 게 많다면 이 방법이 훨씬 빨라. 어디서 꼭 쓸 일이 생길 거야!

## f-string: 서식 맞추기

문자열 앞에 `f`를 붙이면 `{}` 안에 변수나 식을 넣을 수 있어. JS의 템플릿 리터럴 `${}`랑 같아. `{}` 안에 `:`를 붙이면 서식도 정할 수 있어.

```python run
room = "north"
shelf = 7
height = 1.5
print(f"{room} 서가 {shelf}칸")
print(f"높이 {height:.2f}m")     # 소수점 아래 둘째 자리까지
print(f"서가-{shelf:03d}")       # 3자리, 빈자리는 0
print(f"{shelf * 2 + 1}")        # 식도 OK
```

```js compare
`${room} 서가 ${shelf}칸`;          // ← Python: f"{room} 서가 {shelf}칸"
height.toFixed(2);                  // ← Python: f"{height:.2f}"
String(shelf).padStart(3, "0");     // ← Python: f"{shelf:03d}"
```

> 칸 너비를 맞춰 줄 세우는 `{x:>5}`(5칸 오른쪽 정렬)·`{x:<5}`(왼쪽 정렬) 같은 서식도 있어. 표처럼 줄을 맞출 때 꺼내 쓰면 돼.

## 미니 연습

`words`를 `-`로 엮어서 `time-stops-here`가 출력되게, 빈칸에 구분자를 채워 봐.
