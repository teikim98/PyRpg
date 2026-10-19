# 흘림의 주문: 끝까지 읽기와 try/except

마른 나루의 물통 기록은 맨 위에 "몇 줄인지"가 적혀 있지 않아. 모래처럼 줄이 흘러들어 오다가 어느 순간 뚝 끊길 뿐이야. 지금까지는 첫 줄의 N을 보고 `for _ in range(n):`으로 딱 N번 읽었지만, 이제는 **입력이 끝날 때까지** 읽어야 해. 그리고 기록 사이에 섞여 든 깨진 줄은 멈추지 말고 **받아 넘기는** 법도 배워 보자.

## `sys.stdin.read()`: 입력 전체를 한 번에

`sys.stdin.read()`는 남은 입력 **전부를 문자열 하나로** 돌려줘. 여기에 인자 없는 `.split()`을 붙이면 공백과 줄바꿈을 모두 기준으로 잘라서, 줄이 몇 개든 값만 쏙쏙 뽑은 리스트가 돼.

```python
import sys
data = sys.stdin.read().split()    # 입력 전체를 읽어 조각으로
nums = list(map(int, data))
print(len(nums), max(nums))
```

통째로 읽은 입력이 어떤 모양인지는 문자열로 흉내 내면 잘 보여. 입력이 `3`, `5`, `8` 세 줄이면 `read()`는 아래 `text` 같은 문자열 하나를 줘.

```python run
text = "3\n5\n8\n"          # 세 줄짜리 입력을 통째로 읽은 모양
print(repr(text))           # 줄바꿈 \n까지 다 들어 있어
words = text.split()        # 공백·줄바꿈 기준으로 자르고 빈 조각은 버림
print(words)
nums = list(map(int, words))
print(len(nums), "개, 가장 큰 값", max(nums))
```

- `read()`도 빠른 귀(`sys.stdin.readline`)처럼 빨라서, 수십만 개의 값을 읽을 때도 든든해.
- 한 줄에 값이 여러 개든, 줄마다 하나든 `.split()`은 똑같이 잘라 줘. 줄 구분이 필요 없을 때 가장 편한 방법이야.

진짜 `sys.stdin.read()`도 돌려 볼 수 있어. 아래 블록의 입력 칸에 몇 줄을 적고 실행해 봐. 칸을 비워 두면 빈 문자열 `''`을 읽고, 잘라도 빈 리스트야.

```python run
import sys
text = sys.stdin.read()
print(repr(text))
print(text.split())
```

## 함정: 끝 줄바꿈과 빈 문자열

입력의 마지막 줄 끝에도 보통 줄바꿈이 붙어 있어. 그래서 `split("\n")`처럼 **구분자를 직접 주면** 맨 끝에 빈 문자열 `''`이 하나 생겨. 그걸 `int('')`로 바꾸려는 순간 `ValueError`야. 아래 블록은 에러 메시지를 보려고 `try`/`except`로 감쌌어(이 주문이 뭔지는 바로 아래에서!).

```python run
text = "3\n5\n8\n"
print(text.split("\n"))     # 끝에 ''이 붙어!
print(text.split())         # 인자 없는 split()은 빈 조각을 버려
try:
    print(int(""))
except ValueError as e:
    print("ValueError:", e)
```

값만 필요하면 인자 없는 `.split()`을 쓰자. 줄 단위로 나눠야 한다면 바로 다음 방법이 깔끔해.

## `for line in sys.stdin`: 한 줄씩 끝까지

`sys.stdin`을 `for`로 돌면 줄이 남아 있는 동안 **한 줄씩** 꺼내 주고, 입력이 끝나면 반복도 알아서 끝나. 꺼낸 줄에는 `readline()`처럼 끝 줄바꿈이 붙어 있으니 `.split()`이나 `.strip()`으로 다듬어.

```python
import sys
for line in sys.stdin:             # 남은 줄을 하나씩, 끝나면 멈춤
    name, score = line.split()
    print(name, int(score) * 2)
```

`for`가 꺼내 주는 줄이 아래 리스트의 칸들이라고 치고 돌려 보자.

```python run
lines = ["ann 3\n", "bo 5\n", "cy 4\n"]    # 한 줄씩 꺼낸 모양(끝에 \n)
best_name = ""
best = -1
for line in lines:
    name, score = line.split()             # split()이 \n도 떼어 줘
    if int(score) > best:
        best = int(score)
        best_name = name
print(best_name, best)
```

## `try`/`except`: 에러를 받아 넘기는 주문

대도서관에서 문자열 칸을 바꿔 보던 때부터, 교역항의 `KeyError`, 거울 호수의 `RecursionError`까지. 지금까지 레슨에서 "에러 메시지만 보려고 감쌌다"던 `try`/`except`, 그게 바로 이 주문이야. 그때는 메시지를 찍어 보기만 했지만, 이제는 에러를 받아서 **다음 일을 이어 가는** 데 써. 정식으로 배워 보자.

```python
try:
    위험할 수 있는 줄
except ValueError:
    ValueError가 났을 때 할 일
```

- `try:` 아래 줄을 실행하다가 에러가 나면, 그 자리에서 멈추지 않고 **이름이 맞는 `except`**로 뛰어가. 에러가 안 나면 `except` 부분은 건너뛰어.
- `except ValueError as e:`처럼 `as 이름`을 붙이면 에러 메시지를 꺼내 볼 수 있어. 지금까지 본 예제가 이 모양이었지.
- 에러 종류마다 `except`를 여러 개 둘 수 있어. 위에서부터 차례로 맞는 이름을 찾아.

모래가 섞여 든 눈금 기록에서 숫자만 모아 보자. 깨진 칸에서 멈추지 않고 세어 두고 건너뛰어.

```python run
marks = ["12", "7", "모래", "30", "3.5", "18"]
good = []
skipped = 0
for s in marks:
    try:
        good.append(int(s))     # 숫자가 아니면 여기서 ValueError
    except ValueError:
        skipped += 1            # 에러를 받아 넘기고 다음 칸으로
print(good, "건너뜀", skipped)
print("가장 큰 눈금", max(good))
```

```python run
pairs = [("10", "2"), ("7", "0"), ("x", "3")]
for a, b in pairs:
    try:
        print(int(a) // int(b))
    except ValueError:
        print("숫자가 아니야:", a, b)
    except ZeroDivisionError:
        print("0으로는 못 나눠:", a, b)
```

```js compare
try {
  JSON.parse(s);
} catch (e) {               // JS는 catch 하나로 모든 에러를 받고
  if (e instanceof SyntaxError) { /* 종류는 안에서 직접 가려 */ }
}
// ← Python: except ValueError: / except ZeroDivisionError:처럼 받을 종류를 골라 적어
```

## 이름 없는 `except:`는 버그까지 삼켜

`except:`처럼 이름 없이 쓰면 **모든 에러**를 받아 버려. 편해 보이지만, 오타로 생긴 `NameError`까지 조용히 삼켜서 진짜 버그를 숨겨. 아래 블록은 `total`을 `totl`로 잘못 적었는데, 에러 하나 없이 엉뚱한 답만 나와.

```python run
marks = ["4", "5", "6"]
total = 0
skipped = 0
for s in marks:
    try:
        totl += int(s)          # 오타! total이 아니라 totl
    except:
        skipped += 1            # NameError까지 '깨진 칸'으로 세어 버림
print(total, "건너뜀", skipped)  # 0 건너뜀 3: 무엇이 잘못됐는지 안 보여
```

받을 에러의 **이름을 꼭 적자**. 숫자로 못 바꾸는 줄이 걱정이면 `except ValueError:`만. 그러면 예상하지 못한 에러는 그대로 터져서 어디가 틀렸는지 알려 줘.

## `input()`은 끝에서 `EOFError`

`input()`은 읽을 줄이 더 없으면 `EOFError`(End Of File, 입력의 끝)를 내. 그래서 줄 수를 모를 때 `input()`으로 읽으려면 `while True`로 계속 읽다가 `EOFError`를 받으면 `break`하는 모양을 써. 입력 칸에 몇 줄을 적고 돌려 봐(비워 두면 바로 끝나).

```python run
count = 0
while True:
    try:
        line = input()
    except EOFError:            # 더 읽을 줄이 없으면
        break                   # 반복을 끝냄
    count += 1
    print(count, "번째 줄:", line)
print("모두", count, "줄")
```

- 빠른 귀 `sys.stdin.readline()`은 끝에서 에러를 내지 않고 빈 문자열 `''`을 돌려줘. 그래서 `int(sys.stdin.readline())`이 끝에서 `int('')`의 `ValueError`로 터지기도 해.
- 줄 수를 모르는 입력은 `sys.stdin.read().split()`(값만 필요할 때)이나 `for line in sys.stdin`(줄 단위가 필요할 때)이 가장 간단해. `while True` + `try`는 `input()`을 꼭 써야 할 때의 방법이야.

```js compare
// Node에서 입력을 끝까지 모으기
let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {           // 입력이 끝나면
  const nums = data.split(/\s+/).filter(Boolean).map(Number);
});
// ← Python: nums = list(map(int, sys.stdin.read().split()))
// (한 번에 읽기: require("fs").readFileSync(0, "utf8")와 같은 일)
```

## 미니 연습

줄 수를 모르는 입력에서 가장 큰 수를 찾으려고 해. 입력이 끝났을 때 반복을 멈추도록, 빈칸에 받을 에러의 이름을 채워 봐.
