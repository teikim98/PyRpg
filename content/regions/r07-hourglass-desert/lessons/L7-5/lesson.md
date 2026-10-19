# 나머지의 주문: 최대공약수와 진법

해시계 광장의 해시계들은 저마다 다른 눈금을 써. 어떤 건 60씩, 어떤 건 5씩, 어떤 건 16씩 한 바퀴를 돌아. 눈금을 맞추려면 **나머지**를 잘 다뤄야 해. 몫과 나머지를 한 번에 구하는 `divmod`, 두 수를 함께 나누는 가장 큰 수(최대공약수), 그리고 수를 다른 눈금(진법)으로 바꾸는 법을 배워 보자.

## `divmod`: 몫과 나머지를 한 번에

`divmod(a, b)`는 `(a // b, a % b)`를 튜플로 한꺼번에 돌려줘. 나눠 담으면 편해. 시각 200초를 분과 초로 바꿔 보자.

```python run
print(divmod(200, 60))            # (3, 20): 몫 3, 나머지 20
m, s = divmod(200, 60)
print(f"{m}분 {s}초")
h, rest = divmod(7384, 3600)      # 시간부터 떼고
m, s = divmod(rest, 60)           # 남은 걸 분과 초로
print(h, "시간", m, "분", s, "초")
```

## 유클리드 호제법: 최대공약수 구하기

두 수를 모두 나누어떨어지게 하는 가장 큰 수가 **최대공약수**(GCD)야. a와 b의 최대공약수는 b와 `a % b`의 최대공약수와 같아. 그래서 `(a, b)`를 `(b, a % b)`로 계속 바꾸다가 b가 0이 되면 그때의 a가 답이야. 수가 아주 커도 몇십~몇백 번이면 끝나(두 번 바꿀 때마다 a가 반 아래로 줄어서 `O(log N)`).

```python run
a, b = 48, 18
while b:                          # b가 0이 아닌 동안(0은 거짓)
    print(a, b)
    a, b = b, a % b
print("최대공약수", a)
```

## `math.gcd`와 `math.lcm`

`math`에는 최대공약수 `math.gcd(a, b)`와 최소공배수 `math.lcm(a, b)`가 이미 들어 있어. **최소공배수**(LCM)는 두 수의 배수가 처음으로 겹치는 수야. 직접 구할 때는 `a * b // gcd(a, b)`.

```python run
import math

print(math.gcd(48, 18))           # 6: 48 × 18 바닥을 덮는 가장 큰 정사각형 타일 한 변
print(math.lcm(12, 18))           # 36: 12분마다 우는 새와 18분마다 울리는 종이 다시 같이 울 때
print(12 * 18 // math.gcd(12, 18))   # 직접 구해도 36
print(math.gcd(7, 0), math.gcd(0, 0))   # 0과의 최대공약수는 그 수, 둘 다 0이면 0
```

### 함정: `/`로 나누면 실수가 돼

`a * b / gcd`처럼 `/`를 쓰면 결과가 실수(float)가 돼서, 수가 크면 끝자리가 반올림으로 망가져. 정수끼리 나눌 땐 `//`!

```python run
import math

a = 10 ** 17 + 3
b = 10 ** 17 + 7
g = math.gcd(a, b)
print(a * b // g)                 # 정확한 정수
print(a * b / g)                  # 1e+34 근처의 실수: 끝자리가 사라짐
print(int(a * b / g) == a * b // g)   # False
```

## 진법: `int(s, base)`와 `bin`·`oct`·`hex`

`int`에 인자를 하나 더 주면 그 진법으로 읽어. `int("101", 2)`는 2진법 101, 곧 5야. 2진법부터 36진법까지 되고, 10 이상의 숫자는 알파벳(대소문자 상관없음)으로 적어. 반대로 정수를 2·8·16진법 문자열로 바꾸는 내장 함수는 `bin`, `oct`, `hex`인데, 앞에 진법 표시 `0b`, `0o`, `0x`가 붙고 16진법은 **소문자**로 나와.

```python run
print(int("101", 2), int("777", 8), int("ff", 16), int("FF", 16), int("z", 36))
print(bin(10), oct(64), hex(255))
print(bin(10)[2:], hex(255)[2:].upper())   # 앞 두 글자를 떼고, 대문자로
try:
    print(int("12", 2))                    # 2진법에는 2라는 숫자가 없어
except ValueError as e:
    print("ValueError:", e)
```

## k진법으로 직접 바꾸기

3진법, 5진법처럼 내장 함수가 없는 진법은 직접 바꿔야 해. 방법은 **k로 나눈 나머지를 모으기**야. n을 k로 나누면 나머지가 맨 끝자리, 몫을 또 k로 나누면 그다음 자리… 몫이 0이 될 때까지 반복하고, 모은 나머지를 **거꾸로** 읽으면 돼(먼저 나온 게 끝자리라서).

```python run
n = 2024
rems = []
while n > 0:
    n, r = divmod(n, 5)           # 몫과 나머지
    rems.append(str(r))           # 나머지는 끝자리부터 나옴
print(rems)                       # ['4', '4', '0', '1', '3']
five = "".join(rems)[::-1]        # 거꾸로 읽기
print(five, int(five, 5))         # 31044, 다시 10진법으로 읽으면 2024
```

### 0은 따로, 10 이상은 글자로

- n이 처음부터 0이면 `while n > 0:`이 한 번도 돌지 않아서 **빈 문자열**이 나와. 0은 어느 진법으로도 `"0"`이니 따로 챙겨.
- 10진법보다 큰 진법에서는 나머지가 10 이상일 수 있어. 숫자 하나로 적어야 하니 `"0123456789ABCDEF"[r]`처럼 글자 표에서 꺼내 써(10 → `A`, 15 → `F`).

```python run
n = 0
rems = []
while n > 0:
    n, r = divmod(n, 5)
    rems.append(str(r))
print(repr("".join(rems)))        # '': 0인데 아무것도 안 나옴!

symbols = "0123456789ABCDEF"
print(symbols[10], symbols[15])   # A F
q, r = divmod(250, 16)            # 250 = 15 × 16 + 10
print(q, r, symbols[q] + symbols[r], hex(250))   # 15 10 FA 0xfa
```

```js compare
parseInt("ff", 16);       // 255         ← Python: int("ff", 16)
(255).toString(16);       // "ff"        ← Python: hex(255)[2:]
(2024).toString(5);       // "31044"     ← Python엔 이런 내장 함수가 없어서 직접 바꿔
parseInt("12", 2);        // 1 (읽을 수 있는 데까지만 읽음) ← Python은 ValueError
```

## 미니 연습

유클리드 호제법으로 84와 36의 최대공약수를 구해 봐. 빈칸에 나머지를 구하는 연산자를 채우면 `12`가 나와야 해.
