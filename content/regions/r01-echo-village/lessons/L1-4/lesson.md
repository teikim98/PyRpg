# 빠른 귀의 주문: `sys.stdin.readline`

입력이 몇 줄 안 될 때는 `input()`으로 충분해. 그런데 입력이 수십만 줄씩 쏟아지는 문제에서는 `input()`이 느려서 시간 초과가 날 수 있어. 그래서 백준에서 Python을 쓰는 사람들은 **빠른 귀**를 습관처럼 써!

## 주문 외우기

```python
import sys
input = sys.stdin.readline   # 이제부터 input()은 빠른 귀!

n = int(input())
```

`import sys`로 `sys` 주문 묶음을 가져오고, `input`이라는 이름에 `sys.stdin.readline`을 덮어써. 그다음부터는 평소처럼 `input()`이라고 쓰면 돼.

## 주의: 줄 끝에 꼬리가 달려 와

`input()`은 줄 끝의 줄바꿈 문자를 떼어서 주지만, `sys.stdin.readline()`은 줄바꿈 문자 `\n`까지 **꼬리째** 돌려줘. 눈에 안 보이는 꼬리라서 `repr()`로 찍어 봐야 보여.

```python run
line = "ab\n"            # readline이 'ab' 한 줄을 읽으면 이런 모양이야
print(repr(line))        # 'ab\n'  ← 꼬리가 보이지?
print(repr(line.strip()))
print(len(line), len(line.strip()))
```

- `.strip()`은 앞뒤의 공백과 줄바꿈을 모두 떼어 줘. 뒤쪽만 떼려면 `.rstrip()`.
- 숫자는 걱정 없어. `int("3\n")`은 줄바꿈을 알아서 무시하고 `3`이 돼.
- `split()`도 줄바꿈을 알아서 무시해. 그래서 `map(int, input().split())`은 그대로 써도 돼.

```python run
print(int("3\n") + 1)
print("10 20\n".split())
```

```js compare
"ab\n".trim();     // "ab"  ← Python의 .strip()
"ab\n".trimEnd();  // "ab"  ← Python의 .rstrip()
```

## 문자열 곱하기

문자열에 정수를 곱하면 그 횟수만큼 이어 붙여. 곱하는 쪽은 꼭 **정수**여야 해!

```python run
print("ab" * 3)
print("-" * 10)
print("메아리" * 2)
```

```js compare
"ab".repeat(3);    // "ababab"  ← Python은 "ab" * 3
"ab" * 3;          // NaN       ← JS에선 이러면 안 돼!
```

꼬리를 안 떼고 곱하면 어떻게 될까? `"ab\n" * 3`은 `ab`가 세 줄로 찍혀. 메아리 골목의 유령이 노리는 게 바로 이거야!

## 미니 연습

`ab`가 입력되면 `ababab`가 나오도록, 빈칸에 꼬리를 떼는 주문을 적어 봐!
