# 되풀이의 주문: `for`와 `range`

내 지도 좀 봐. 이 길은 동그란 **고리**로 그려져 있어. 같은 길을 몇 번이고 다시 걷게 되는 곳이지. 같은 일을 여러 번 할 때 줄을 복사해 붙이는 대신, **되풀이의 주문** 한 줄이면 돼!

## `for`와 `range`: 정해진 횟수만큼

`range(n)`은 0부터 n - 1까지 세는 '수의 길'이야. `for i in range(n):`은 그 길을 따라 i에 수를 하나씩 담으면서 블록을 n번 실행해. `if`처럼 콜론과 들여쓰기!

```python run
for i in range(3):
    print("걸음", i)
print("고리를 한 바퀴 돌았다!")
```

```js compare
for (let i = 0; i < 3; i++) {
  console.log("걸음", i);
}
// Python: for i in range(3):  ← 시작·조건·증가를 range가 한 번에!
```

## `range(시작, 끝, 간격)`: 끝은 포함하지 않아

값을 두 개 주면 시작과 끝, 세 개 주면 간격까지 정할 수 있어. 여기서 제일 중요한 규칙 하나: **끝 값은 포함하지 않아.**

```python run
for i in range(1, 6):        # 1, 2, 3, 4, 5  (6은 안 들어감!)
    print(i, end=" ")
print()
for i in range(0, 20, 5):    # 5씩 건너뛰기
    print(i, end=" ")
print()
for i in range(5, 0, -1):    # 간격이 음수면 거꾸로. 0은 안 들어감
    print(i, end=" ")
print()
```

- 1부터 n까지 세려면 `range(1, n + 1)`. 이 `+ 1`을 빼먹는 게 숲에서 제일 흔한 실수야!
- 거꾸로 0까지 세려면 `range(n, -1, -1)`. 끝 값 `-1`은 포함되지 않으니까 0에서 멈춰.

```js compare
for (let i = 1; i <= n; i++)      // Python: range(1, n + 1)
for (let i = 0; i < 20; i += 5)   // Python: range(0, 20, 5)
for (let i = 5; i > 0; i--)       // Python: range(5, 0, -1)
```

## 반복 안에서 쌓아 가기

반복문의 단골 짝꿍은 **누적**이야. 반복 밖에 0을 하나 두고, 돌 때마다 더해.

```python run
total = 0
for i in range(1, 11):
    total += i          # total = total + i
print("1부터 10까지 합:", total)
```

> JS의 `i++`는 Python에 없어. `i += 1`로 써!

## f-string: 출력 틀에 값 끼우기

문자열 앞에 `f`를 붙이고 중괄호 `{}` 안에 변수나 식을 넣으면, 그 자리에 값이 들어가. JS의 템플릿 리터럴이랑 똑같아.

```python run
n = 3
for i in range(1, 4):
    print(f"{n} x {i} = {n * i}")
```

```js compare
console.log(`${n} x ${i} = ${n * i}`);
// Python: print(f"{n} x {i} = {n * i}")  ← 백틱 대신 f"...", ${} 대신 {}
```

## 미니 연습

`1 2 3 4 5`가 한 줄에 출력되도록 빈칸에 끝 값을 적어 봐. 끝 값은 포함되지 않는다는 거, 기억하지?
