# 모음의 주문: 여러 줄 입력 받기

백준 문제의 입력은 대부분 이렇게 생겼어. 첫 줄에 개수 N, 그다음 N줄에 값이 하나씩. 지금까지 배운 반복문으로 **한 줄씩 모으는 주문**을 완성하자!

## 기본 틀: N을 읽고, N번 읽기

`input()`은 부를 때마다 **다음 줄**을 읽어. 그러니까 반복문 안에서 N번 부르면 N줄을 차례로 읽게 돼.

```python
import sys
input = sys.stdin.readline

n = int(input())          # 첫 줄: 개수
for _ in range(n):        # N번 되풀이
    w = int(input())      # 한 줄씩 읽기
    # 여기서 w로 할 일을 한다
```

- `_`는 "이 변수는 안 쓸 거야"라는 표시야. 몇 번째인지는 필요 없고 횟수만 중요할 때 써. 문법은 그냥 평범한 변수 이름이야.
- 입력이 수만 줄이면 `input()`이 느리니까 빠른 귀(`sys.stdin.readline`)를 꼭 함께 써. `int()`가 줄 끝 개행을 알아서 무시해 줘.

```js compare
// Node에서 백준 입력은 보통 한 번에 다 읽어서 줄로 잘랐지
const lines = require("fs").readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
for (let i = 1; i <= n; i++) { const w = Number(lines[i]); }
// Python은 input()을 N번 부르면 한 줄씩 차례로 읽혀
```

## 누적합 패턴

반복 **밖에** 0을 두고, 돌 때마다 더해. 아래는 입력 대신 `split()`으로 값을 하나씩 꺼내서 실험한 거야(실전에서는 `int(input())` 자리에 들어가).

```python run
data = "3 9 2 7 5"          # 입력 다섯 줄이 이렇게 왔다고 치고
total = 0
for token in data.split():
    w = int(token)
    total += w
print("무게 합:", total)
```

## 최댓값 패턴

'지금까지 본 것 중 최고'를 변수 하나에 기억해 두고, 더 큰 값을 만나면 바꿔. 위치가 필요하면 함께 기억해.

```python run
data = "3 9 2 9 5"
best = 0
pos = 0
i = 0
for token in data.split():
    i += 1                   # 1부터 세는 위치
    w = int(token)
    if w > best:             # 같을 땐 안 바꿈 → 앞쪽이 남는다
        best = w
        pos = i
print("가장 무거운 무게:", best, "위치:", pos)
```

- 처음 값은 나올 수 있는 어떤 값보다도 작게. 값이 모두 1 이상이면 `0`으로 충분해. 음수도 나오면 `float("-inf")`(JS의 `-Infinity`)로 시작해.
- `>`와 `>=`는 같은 값이 여러 개일 때 결과가 달라. 문제에서 '앞쪽'인지 '뒤쪽'인지 꼭 읽어 봐.

```js compare
let best = -Infinity;            // Python: best = float("-inf")
for (const w of weights) if (w > best) best = w;
```

## 미니 연습

입력의 첫 줄은 개수, 다음 줄부터 값이 하나씩 와. 빈칸에 반복 횟수를 적어서 세 값의 합 `60`을 출력해 봐!
