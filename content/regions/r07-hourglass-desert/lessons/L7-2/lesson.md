# 모래시계의 주문: 시간복잡도

바람 협곡의 모래시계는 모래가 다 떨어지기 전에 끝나는 주문만 받아들여. 답이 맞아도 너무 오래 걸리면 소용없어. 그런데 "오래 걸린다"를 어떻게 미리 알 수 있을까? 컴퓨터마다 빠르기가 다르니까 초를 재는 대신, **일을 몇 번 하는지**를 입력 크기 N의 식으로 세어 보는 거야. 이 식을 **시간복잡도**라고 하고 `O(N)`처럼 적어.

## 반복 횟수를 직접 세어 보기

반복 안에 `steps += 1`을 넣으면 그 줄이 몇 번 실행되는지 셀 수 있어. 반복 하나는 N번, 반복 안에 반복이 들어가면 **곱**이 돼.

```python run
def count_single(n):
    steps = 0
    for i in range(n):
        steps += 1
    return steps

def count_double(n):
    steps = 0
    for i in range(n):
        for j in range(n):      # 바깥 한 번마다 안쪽이 n번
            steps += 1
    return steps

for n in [10, 100, 1000]:
    print(n, count_single(n), count_double(n))
```

N이 10배가 되면 반복 하나는 10배, 겹친 반복은 **100배**로 늘어나. 앞의 것을 `O(N)`, 뒤의 것을 `O(N²)`이라고 해.

- 반복이 **나란히** 두 번이면 더하기(N + N = 2N)라서 여전히 `O(N)`이야. 앞에 붙는 2 같은 수는 떼고, N이 커질 때 가장 빨리 커지는 부분만 남겨.
- 반복이 **안에** 들어가면 곱하기(N × N)야. 세 겹이면 N³.

## 반씩 줄이면 `O(log N)`

남은 일을 매번 반으로 줄이면 아주 큰 N도 금방 끝나. 몇 번 반으로 나눠야 1이 되는지가 log₂N이야. 10억도 서른 번이면 끝!

```python run
def count_half(n):
    steps = 0
    while n > 1:
        n //= 2                 # 매번 반으로
        steps += 1
    return steps

for n in [8, 1000, 10 ** 6, 10 ** 9, 10 ** 18]:
    print(n, count_half(n))
```

N번 도는 반복이 한 번마다 log N만큼 일하면 둘을 곱해서 `O(N log N)`이야. 리스트를 정렬하는 `sorted`가 대표적이야. N이 20만이어도 몇백만 번 정도라 넉넉해.

## 입력 크기로 목표 복잡도 정하기

문제의 입력 범위를 보면 어떤 복잡도로 짜야 하는지 거꾸로 정할 수 있어. 이 게임과 실제 코딩테스트의 Python은 **1초에 대략 천만 번 안팎**의 단순한 연산을 한다고 어림해. 이건 기기와 연산 종류에 따라 몇 배씩 달라지는 **추정값**이라, 정확한 수보다는 "자릿수 감"으로만 써.

```python run
n = 10 ** 5                     # N이 10만이라면
per_sec = 10 ** 7               # 1초에 천만 번(어림값)
print("O(N)      :", n, "번")
print("O(N log N):", n * 17, "번")       # log₂(10만)은 약 17
print("O(N²)     :", n * n, "번")
print("O(N²)이면 약", n * n // per_sec, "초")
```

| 입력 크기 N | 목표로 삼을 복잡도 | 이유(어림) |
|---|---|---|
| 1,000 이하 | `O(N²)`도 괜찮음 | 100만 번 |
| 10만~20만 | `O(N log N)`이나 `O(N)` | N²이면 100억 번 이상이라 못 끝냄 |
| 10억 이상 | `O(log N)`이나 `O(1)`(식 하나로) | N번 도는 것조차 너무 많음 |

문제를 읽으면 입력 범위부터 보고, "이 크기에서 겹친 반복을 써도 되나?"를 먼저 따져 보자.

## 숨은 `O(N)`: 한 줄인데 N번 일하는 것들

코드 한 줄이 늘 한 번의 일은 아니야. 아래 연산은 겉보기엔 한 줄이지만 속에서 리스트를 처음부터 훑거나 통째로 복사해서 **그 자체가 `O(N)`**이야. 이걸 반복 안에 넣으면 눈에 안 보이는 겹친 반복이 돼서 `O(N²)`이 되지.

| 연산 | 속에서 하는 일 |
|---|---|
| `x in arr`(리스트) | 앞에서부터 하나씩 비교 |
| `arr.count(x)`, `arr.index(x)` | 앞에서부터 훑기 |
| `arr.pop(0)`, `arr.insert(0, x)` | 뒤의 칸을 전부 한 칸씩 밀기 |
| `arr[:i]`, `arr[i:]` | i칸(나머지 칸)을 새 리스트로 복사 |
| `sum(arr[:i])` | 복사하고 또 더하기 |
| 문자열 `s += "a"`를 아주 여러 번 | 매번 새 문자열을 만들 수 있음 |

`x in arr`가 속에서 하는 일을 그대로 흉내 내서 세어 보자.

```python run
def find_steps(arr, x):          # x in arr가 속에서 하는 일
    steps = 0
    for v in arr:
        steps += 1
        if v == x:
            break
    return steps

arr = list(range(1000))
print(find_steps(arr, 3))        # 앞쪽에 있으면 금방
print(find_steps(arr, 999))      # 맨 뒤면 1000번
print(find_steps(arr, -1))       # 없으면 끝까지 1000번
```

반복 안의 `sum(arr[:i])`도 세어 보면, 반복은 N번인데 실제 일은 1 + 2 + … 으로 불어나. 지금까지의 합을 변수 하나에 **들고 다니면** 반복 한 번에 일도 한 번이야.

```python run
arr = [3, 1, 4, 1, 5, 9, 2, 6]

work = 0
for i in range(len(arr)):
    work += i                    # sum(arr[:i])는 i칸을 복사하고 더함
print("슬라이스 합:", work, "번 일")

work = 0
running = 0                      # 지금까지의 합을 들고 다님
for x in arr:
    print(running, end=" ")      # arr[:i]의 합과 같은 값
    running += x
    work += 1
print()
print("들고 다니기:", work, "번 일")
```

N이 8일 때는 28번과 8번이라 차이가 작아 보이지만, N이 20만이면 약 200억 번과 20만 번이야.

- 맨 앞에서 자주 빼고 넣으면 `list.pop(0)` 대신 교역항의 `deque`(`popleft`, `appendleft`).
- 문자열을 조각조각 이어 붙일 땐 리스트에 모았다가 대도서관의 `"".join(조각들)`로 한 번에.
- 찾기를 자주 하면 리스트 대신 set·dict(다음 비석에서).

```js compare
arr.includes(x);      // JS도 앞에서부터 훑어서 O(N)  ← Python: x in arr
arr.indexOf(x);       // O(N)                        ← Python: arr.index(x)
arr.shift();          // 뒤의 칸을 다 당겨서 O(N)     ← Python: arr.pop(0)
arr.slice(0, i);      // i칸 복사, O(i)              ← Python: arr[:i]
// 숨은 비용은 언어와 상관없어. 어느 언어든 같은 자료구조면 같은 일을 해!
```

## 미니 연습

남은 수를 매번 반으로 줄이는 반복이야. 1024가 1이 될 때까지 몇 번 줄이는지 세도록 빈칸에 연산자를 채워 봐.
