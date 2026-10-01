# 갈림길의 주문: `if`, `elif`, `else`

이 숲은 걸음마다 길이 갈라져. 어느 길로 갈지 **조건을 보고 고르는 주문**이 없으면 한 발짝도 못 나가! 코딩테스트에서도 "짝수면 이렇게, 아니면 저렇게"가 거의 모든 문제에 나와.

## `if`와 `else`: 두 갈래

조건 뒤에 **콜론(`:`)**을 찍고, 그 조건일 때 할 일을 **한 단계 들여쓰기**(공백 4칸)해서 적어. 들여쓰기가 같은 줄끼리 한 덩어리(블록)야.

```python run
n = 7
if n % 2 == 0:
    print("짝수니까 왼쪽 길")
else:
    print("홀수니까 오른쪽 길")
print("들여쓰기 밖은 언제나 실행돼")
```

```js compare
// JS는 괄호와 중괄호로 블록을 만들지
if (n % 2 === 0) {
  console.log("짝수니까 왼쪽 길");
} else {
  console.log("홀수니까 오른쪽 길");
}
// Python: 조건 괄호 없음, { } 대신 콜론 + 들여쓰기
```

> 들여쓰기는 장식이 아니라 **문법**이야. 칸 수가 어긋나면 `IndentationError`가 나. 공백 4칸으로 통일하자!

## `elif`: 여러 갈래

갈래가 셋 이상이면 `elif`(else if의 줄임말)를 이어 붙여. **위에서부터** 조건을 보다가 처음 참인 블록 하나만 실행하고 나머지는 건너뛰어.

```python run
score = 85
if score >= 90:
    print("A")
elif score >= 80:
    print("B")   # 85는 여기서 걸리고 끝!
elif score >= 70:
    print("C")
else:
    print("F")
```

`elif score >= 80:`까지 내려왔다면 이미 "90 미만"이라는 뜻이야. 그래서 **큰 조건부터** 적어야 해. 순서를 거꾸로 쓰면 85점이 `score >= 70`에서 먼저 걸려 버려.

```js compare
if (score >= 90) { ... }
else if (score >= 80) { ... }   // Python은 elif 한 단어!
else { ... }
```

## 비교 연산자와 연쇄 비교

`<`, `<=`, `>`, `>=`, `==`, `!=`는 JS와 같아. 다만 Python에는 `===`가 없어. Python의 `==`가 처음부터 JS의 `===`처럼 **자료형까지** 따지거든.

그리고 Python만의 꿀기능: 비교를 **이어 쓸 수** 있어!

```python run
x = 5
print(0 < x < 10)      # 0 < x 이고 x < 10
print(1 == 1.0)        # 숫자끼리는 값으로 비교
print(1 == "1")        # 숫자와 문자열은 언제나 다름
```

```js compare
0 < x && x < 10;   // JS에서 0 < x < 10은 (0 < x) < 10 → true < 10 → 언제나 true!
1 === "1";         // false  ← Python의 1 == "1"과 같음
```

## `and`, `or`, `not`

조건을 엮을 땐 기호가 아니라 **영어 단어**를 써.

```python run
year = 2024
print(year % 4 == 0 and year % 100 != 0)   # 그리고
print(year % 400 == 0 or year % 4 == 0)    # 또는
print(not year > 3000)                     # 아니다
```

```js compare
a && b;   // Python: a and b
a || b;   // Python: a or b
!a;       // Python: not a
```

## 조심! `=`와 `==`

`=`는 이름표 붙이기(대입), `==`는 같은지 묻기(비교)야. `if x = 3:`이라고 쓰면 Python이 `SyntaxError`로 막아 줘. 메시지에 `Maybe you meant '=='`가 보이면 바로 이 실수야.

## 미니 연습

`0`이 입력되면 `영`이 나오도록, 빈칸에 두 번째 갈래를 여는 주문을 적어 봐!
