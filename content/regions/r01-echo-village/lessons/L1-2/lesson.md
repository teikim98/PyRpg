# 변환의 주문: 문자열을 숫자로, 숫자를 문자열로

`input()`으로 들은 말은 전부 문자열이라고 했지? 그런데 문제는 대부분 숫자로 계산해야 해. 그래서 **자료형을 바꾸는 주문**이 꼭 필요해!

## 자료형 네 가지

서펜트 룬의 기본 자료형은 이 넷이야. `type()`으로 확인할 수 있어.

```python run
print(type(3))       # int: 정수
print(type(3.5))     # float: 실수(소수점이 있는 수)
print(type("3"))     # str: 문자열
print(type(True))    # bool: 참/거짓
```

```js compare
typeof 3;      // "number"  ← JS는 정수와 실수를 구분하지 않아
typeof 3.5;    // "number"
typeof "3";    // "string"
typeof true;   // "boolean" ← Python은 True, False처럼 첫 글자가 대문자!
```

## JS와 제일 다른 점: 알아서 안 바꿔 줘

JS는 `"1" + 2`를 알아서 `"12"`로 만들어 주지만, Python은 **에러**를 내. 문자열과 숫자를 섞으면 직접 바꿔 줘야 해.

```python
print("1" + 2)
# TypeError: can only concatenate str (not "int") to str
```

```js compare
"1" + 2;   // "12"  (JS는 몰래 문자열로 바꿈)
"5" - 2;   // 3     (이번엔 몰래 숫자로 바꿈…)
// Python은 둘 다 TypeError! 헷갈릴 일이 없어서 오히려 좋아
```

## `int()`, `float()`, `str()`, 그리고 `len()`

```python run
print(int("42") + 1)       # 문자열 → 정수
print(float("2.5") * 2)    # 문자열 → 실수
print(str(42) + "개")      # 정수 → 문자열
print(len("python"))       # 문자열의 글자 수
print(len(str(12345)))     # 숫자의 자릿수는 문자열로 바꿔서 세기
```

```js compare
Number("42") + 1;    // parseInt("42")도 비슷
String(42) + "개";
"python".length;     // Python은 .length 대신 len("python")
```

## 한 줄에 숫자 여러 개: 통째로 외우는 주문

입력이 `3 4`처럼 한 줄에 여러 개 오면 `split()`으로 공백 기준으로 자르고, `map(int, ...)`으로 전부 정수로 바꿔. 이 줄은 원리는 나중에(지역 6) 배우고, 지금은 **통째로 외우는 주문**이야!

```python
a, b = map(int, input().split())
```

입력 대신 문자열로 직접 실험해 보자.

```python run
line = "3 4"                     # input()이 이런 문자열을 준다고 치고
print(line.split())              # ['3', '4']  ← 아직 문자열 두 개
a, b = map(int, line.split())    # 둘 다 정수로!
print(a + b)
```

```js compare
const [a, b] = "3 4".split(" ").map(Number);
// Python: a, b = map(int, "3 4".split())
```

## 비교하면 `bool`이 나와

`>`, `<`, `==`, `!=`, `>=`, `<=`로 비교하면 결과는 `True` 아니면 `False`야. 그대로 출력할 수도 있어.

```python run
print(3 < 5, 3 == 5)
print(1 == "1")        # 숫자와 문자열은 몰래 바꿔 비교하지 않아서 False
print("12" < "9")      # 문자열끼리는 사전 순서! 첫 글자 '1'이 '9'보다 앞
print(int("12") < int("9"))
```

```js compare
1 == "1";      // true  (JS의 ==는 몰래 바꿔서 비교)
1 === "1";     // false (Python의 ==는 이쪽처럼 동작해)
"12" < "9";    // true  (JS도 문자열끼리는 사전 순서라 똑같이 속아)
```

## 미니 연습

`3 4`가 입력되면 `7`이 나오도록, 빈칸에 들어갈 변환 주문을 적어 봐!
