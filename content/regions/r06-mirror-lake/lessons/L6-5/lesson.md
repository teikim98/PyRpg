# 기억의 주문: 메모이제이션

메아리 여울의 메아리는 같은 말을 몇 번이고 되풀이해. 재귀도 그래. 같은 값을 묻는 호출이 여러 갈래에서 다시 나오면, 매번 처음부터 다시 계산하느라 호출 수가 눈덩이처럼 불어나. 해결법은 간단해. **한 번 계산한 답은 적어 두고, 다시 물으면 적어 둔 걸 꺼내 쓰기.** 이걸 **메모이제이션**(메모)이라고 해.

## 호출 횟수가 폭발한다

피보나치 수 `fib(n) = fib(n - 1) + fib(n - 2)`를 그대로 재귀로 짜면, `fib(n - 2)`를 두 갈래에서 또 계산하고, 그 아래도 또… n이 5 늘 때마다 호출이 약 11배씩 늘어. 직접 세어 보자.

```python run
calls = 0
def fib(n):
    global calls          # 호출 횟수를 세려고 잠깐 global을 썼어
    calls += 1
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

for n in [10, 15, 20]:
    calls = 0
    print(n, fib(n), "호출", calls, "번")
```

`fib(40)`이면 호출이 3억 번을 넘어서 시간 결계를 절대 못 넘어.

재귀가 몇 번 불리는지 줄마다 직접 보고 싶다면 **메아리 고리**를 써 봐. 호숫가 나루 상점에서 파는 장신구야. 장착하고 전투에서 **[예제 실행]**을 누르면 에디터의 줄 번호 옆에 그 줄이 몇 번 실행됐는지 `×N`으로 보여 줘. 메모를 붙이기 전과 후의 숫자를 비교하면 차이가 한눈에 보여.

## dict 메모: 한 번 계산한 답은 적어 두기

`memo = {}`를 함수 바깥에 두고, 계산하기 전에 `n in memo`로 먼저 확인해. 있으면 꺼내 쓰고, 없으면 계산해서 적어 둔 다음 돌려줘. 이제 `fib(n)`마다 계산은 딱 한 번이야.

```python run
calls = 0
memo = {}
def fib(n):
    global calls
    calls += 1
    if n < 2:
        return n
    if n in memo:                 # 이미 계산했으면 꺼내 쓰기
        return memo[n]
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(90))                    # 순식간!
print("호출", calls, "번, 적어 둔 값", len(memo), "개")
```

```js compare
const memo = new Map();                    // ← Python: memo = {}
function fib(n) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);     // ← if n in memo: return memo[n]
  const v = fib(n - 1) + fib(n - 2);
  memo.set(n, v);                          // ← memo[n] = ...
  return v;
}
```

`solution` 안에 `memo`와 재귀 도우미 함수를 함께 둬도 돼(되울림의 비석에서 본 함수 안의 함수). `memo[n] = …`은 이름이 아니라 dict의 칸을 고치는 거라 안쪽 함수에서도 괜찮고, `solution`을 부를 때마다 빈 장부로 새로 시작해.

## `lru_cache`와 `cache`: 메모를 대신 해 주는 주문

`functools`의 `lru_cache`를 함수 위에 `@`로 붙이면, 인자가 같은 호출의 결과를 알아서 기억해 줘. `@`는 **데코레이터**라고 해서 '아래 함수를 감싸서 바꿔 주는 함수'야. `@cache`를 붙이는 건 `fib = cache(fib)`라고 쓰는 것과 같아. JS에는 아직 `@`가 없지만, `const fib = memoize(function (n) {...})`처럼 함수를 감싸는 함수를 직접 만드는 것과 똑같은 일이야.

```python run
from functools import lru_cache, cache

@lru_cache(maxsize=None)     # 결과를 전부 기억
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
print(fib(150))

@cache                       # lru_cache(maxsize=None)과 같은 뜻의 짧은 이름
def stairs(n):               # 한 번에 1칸이나 2칸 오르는 방법 수
    if n <= 1:
        return 1
    return stairs(n - 1) + stairs(n - 2)
print(stairs(100))
```

- 맨 위의 `from functools import lru_cache`(또는 `cache`)를 빠뜨리면 `NameError: name 'lru_cache' is not defined`가 나.
- 인자는 숫자·문자열·튜플처럼 바뀌지 않는 값이어야 해. 리스트를 넘기면 `unhashable type` 에러가 나(dict의 키와 같은 규칙).
- 브라우저에서는 `lru_cache`를 붙인 재귀가 깊이 수백에서 멈출 수 있어(되울림의 비석). 이 게임의 문제는 깊이 200 이하로 냈으니 안심해.

## 함정: `@lru_cache`는 기본으로 128개만 기억해

괄호 없이 `@lru_cache`라고만 쓰거나 `@lru_cache()`로 쓰면 **최근 128개**만 기억하고, 넘치면 가장 오래 안 쓴 것부터 잊어버려(`maxsize=128`이 기본값). 서로 다른 값이 많거나 질문이 여러 개면 계속 잊고 다시 계산하느라 메모가 거의 소용없어져. 그래서 코딩테스트에서는 **`@lru_cache(maxsize=None)`이나 `@cache`**를 쓰자.

```python run
from functools import lru_cache, cache

calls = 0
@lru_cache                   # 괄호 없이 쓰면 maxsize=128
def depth_a(x):
    global calls
    calls += 1
    return x * x
for _ in range(2):           # 같은 질문 200개를 두 번
    for x in range(200):
        depth_a(x)
print("기본 lru_cache:", calls, "번 계산")    # 400: 두 번째에도 하나도 기억 못 함

calls = 0
@cache
def depth_b(x):
    global calls
    calls += 1
    return x * x
for _ in range(2):
    for x in range(200):
        depth_b(x)
print("cache:", calls, "번 계산")              # 200: 두 번째는 전부 꺼내 씀
```

## 메모는 '필요한 값만' 적는다

아래에서부터 `dp = [0] * (n + 1)`처럼 리스트를 채우는 방법도 있지만, 그러면 0부터 n까지 **모든 칸**을 만들어야 해. n이 10^18이면 그런 리스트는 만들 수조차 없어. dict 메모는 재귀가 **실제로 물어본 값만** 적으니까, 문제가 반씩 줄어드는 재귀라면 n이 아무리 커도 몇십~몇백 칸이면 끝나.

```python run
memo = {}
def knots(n):                # 길이 n인 갈대를 반으로, 또 반으로 자르면 마디가 몇 개?
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    half = n // 2
    memo[n] = knots(half) + knots(n - half)
    return memo[n]

print(knots(10 ** 18))       # 답은 n과 같아야 해(확인하기 쉬운 예)
print(len(memo))             # 적어 둔 값은 겨우 이만큼
```

- 같은 값을 다시 계산하는 재귀를 보면 메모! dict 메모나 `@cache`.
- `@lru_cache`만 쓰면 128개 한도. `maxsize=None`을 잊지 말기.
- n이 아주 크면 리스트 대신 dict에 필요한 값만.

## 미니 연습

이미 계산한 값인지 확인하는 줄의 빈칸을 채워서 `fib(90)`을 순식간에 구해 봐.
