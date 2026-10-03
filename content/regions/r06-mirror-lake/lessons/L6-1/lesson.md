# 부름의 주문: 함수

호숫가 나루의 뱃사공은 손님이 올 때마다 똑같은 계산을 해. 거리를 재고, 짐을 세고, 뱃삯을 매기고. 같은 계산을 매번 새로 적는 대신 이름을 붙여 두고 **불러서** 쓰는 것, 그게 **함수**야. JS의 `function`과 거의 같아.

## `def`와 `return`

`def 이름(매개변수):` 다음 줄부터 들여 쓴 부분이 함수 몸통이야. `return 값`을 만나면 그 값을 들고 바로 함수 밖으로 나가. 함수는 만들기만 하면 아무 일도 안 일어나고, `이름(인자)`로 불러야 실행돼.

```python run
def fare(km):
    return km * 3 + 2

print(fare(4))            # 14
print(fare(10))           # 32
total = fare(1) + fare(2)
print(total)              # 5 + 8 = 13
```

```js compare
function fare(km) {        // ← Python: def fare(km):
  return km * 3 + 2;       // 같아! (중괄호 대신 들여쓰기)
}
const fare2 = (km) => km * 3 + 2;   // 화살표 함수는 L6-3의 lambda에서
```

## `return`이 없으면 `None`

`return`을 빠뜨리면 함수는 **`None`**을 돌려줘. JS에서 `undefined`가 돌아오는 것과 같아. 함수 안에서 `print`만 하고 `return`을 안 하면 화면에는 찍히지만 값은 돌아오지 않아. 계산 결과를 바깥에서 써야 한다면 꼭 `return`!

```python run
def shout(name):
    print(name + "!")      # 출력만 하고 return은 없음

result = shout("누리")
print(result)              # None

def check(n):
    if n < 0:
        return "음수"       # 여기서 바로 끝(일찍 return)
    if n == 0:
        return "영"
    return "양수"

print(check(-5), check(0), check(7))
```

- `return`은 함수를 그 자리에서 끝내. 예외 상황을 먼저 `return`으로 걸러 내면 `else`를 겹겹이 쓰지 않아도 돼.
- `return lo, hi`처럼 값 두 개를 돌려주면 튜플로 묶여 와(교역항의 묶음 주문). 받는 쪽은 `lo, hi = f(...)`. 이때 `return`을 빠뜨리면 `None`을 둘로 나눌 수 없어서 `cannot unpack non-iterable NoneType object` 에러가 나.

## 기본값 인자와 키워드 인자

매개변수에 `=기본값`을 주면 부를 때 빼먹어도 돼. 부를 때 `이름=값`으로 넘기면 순서와 상관없이 그 매개변수에 들어가(키워드 인자). 기본값이 있는 매개변수는 기본값이 없는 매개변수보다 뒤에 와야 해.

```python run
def fare(km, bags=0, rate=3):
    return km * rate + bags * 5

print(fare(4))                 # 12: bags=0, rate=3
print(fare(4, 2))              # 22: bags=2
print(fare(4, rate=10))        # 40: bags는 기본값, rate만 바꿈
print(fare(km=2, bags=1))      # 11
print(sorted([3, 1, 2], reverse=True))   # 내장 함수도 키워드 인자를 받아
```

```js compare
function fare(km, bags = 0, rate = 3) {}   // ← Python: def fare(km, bags=0, rate=3):
fare(4, undefined, 10);   // ← Python: fare(4, rate=10)  (이름으로 골라서 넘김)
```

인자 개수가 안 맞으면 JS는 모자란 자리를 `undefined`로 채우고 넘치는 건 무시하지만, Python은 바로 `TypeError`를 내. `missing 1 required positional argument`는 하나 모자라다는 뜻, `takes 1 positional argument but 2 were given`은 넘친다는 뜻이야.

## 지역 변수와 바깥 변수

함수 안에서 만든 변수는 **그 함수 안에서만** 살아(지역 변수). 함수가 끝나면 사라지고, 바깥에 같은 이름이 있어도 서로 다른 변수야. 함수 안에서 바깥 변수를 **읽는** 건 되지만, 바깥 변수에 **새 값을 넣으려면** `global 이름`이라고 먼저 말해야 해. 다만 이건 어디서 값이 바뀌는지 헷갈리게 해서 잘 안 써. 값을 바꾸고 싶으면 `return`으로 돌려받아서 바깥에서 다시 담는 게 깔끔해.

```python run
rate = 3                   # 바깥(전역) 변수
def fare(km):
    cost = km * rate       # 바깥 변수 읽기는 OK, cost는 지역 변수
    return cost
print(fare(5))
# print(cost)  ← 여기서는 cost가 없어서 NameError

trips = 0
def add_trip(t):
    return t + 1           # 바깥을 직접 바꾸지 않고 새 값을 돌려줌
trips = add_trip(trips)
trips = add_trip(trips)
print(trips)               # 2

total = 0
def add_ten():
    global total           # 바깥 total을 바꾸겠다는 선언(되도록 피하자)
    total += 10
add_ten()
print(total)               # 10
```

`global` 없이 함수 안에서 `total += 10`을 하면 `UnboundLocalError`가 나. Python은 함수 안에서 값을 넣는 이름을 전부 지역 변수로 보는데, 아직 그 지역 변수에 값이 없거든.

## 도우미 함수로 나누기

큰 문제는 작은 함수 여러 개로 나누면 읽기 쉽고 실수도 줄어. 한 함수는 한 가지 일만 하게 만들고, 큰 함수(예: `solution`)는 도우미 함수를 불러서 조립만 해.

```python run
def is_vowel(ch):
    return ch in "aeiou"

def count_vowels(word):
    n = 0
    for ch in word:
        if is_vowel(ch):
            n += 1
    return n

def loudest(words):        # 모음이 가장 많은 단어(같으면 먼저 나온 것)
    best = words[0]
    for w in words:
        if count_vowels(w) > count_vowels(best):
            best = w
    return best

print(count_vowels("echo"))                    # 2
print(loudest(["lake", "mirror", "audio"]))    # audio
```

- 함수는 부르기 **전에** `def`로 만들어 둬야 해. 위에서 아래로 읽히니까 도우미 함수를 위쪽에 두자.
- 함수 이름은 무엇을 돌려주는지 알 수 있게: `is_...`는 참/거짓, `count_...`는 개수처럼.

## 미니 연습

`double(21)`이 `42`를 돌려주도록 빈칸에 알맞은 낱말을 채워 봐.
