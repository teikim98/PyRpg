# 멈춤의 주문: `while`, `break`, `continue`

개울이 흐르다 말고 멈춰 있지? 이 숲에서는 **언제 멈출지 아는 것**이 제일 중요해. 몇 번 돌지 미리 모를 땐 `for` 대신 `while`을 쓰고, 멈추는 법까지 같이 배우자!

## `while`: 조건이 참인 동안

`while 조건:`은 조건이 참인 동안 블록을 계속 되풀이해. 블록을 한 번 돌 때마다 조건을 다시 확인해.

```python run
water = 100
days = 0
while water > 10:
    water = water // 2      # 매일 절반씩 줄어든다
    days += 1
print(days, "일 뒤 남은 물:", water)
```

`for`는 '몇 번'이 정해져 있을 때, `while`은 '언제까지'만 알 때 써.

```js compare
while (water > 10) {
  water = Math.floor(water / 2);
  days++;
}
// Python도 똑같이 while. 괄호와 { } 대신 콜론 + 들여쓰기
```

## 무한루프와 시간 결계

`while`의 조건이 **영원히 참**이면 반복이 끝나지 않아. 이게 무한루프야.

```python
n = 5
while n > 0:
    print(n)     # n을 줄이는 줄을 빼먹었다!
```

n이 계속 5라서 영원히 돌아. 세르펜티아에선 "모든 주문은 제시간에 끝나야 한다"는 말이 있을 만큼, 끝나지 않는 주문을 제일 무서워해. 그래서 이 숲의 버그들은 **시간 결계**를 쳐 두었어. 주문이 제한 시간 안에 끝나지 않으면 결계가 주문을 끊고 **시간 초과(TLE)**로 판정해.

`while`을 쓸 때마다 스스로 물어봐.

- 조건에 쓰인 변수가 **반복마다 바뀌고** 있나?
- 그 변화가 **조건이 거짓이 되는 쪽**으로 가고 있나?

## `break`: 지금 바로 빠져나가기

`break`를 만나면 반복을 즉시 끝내. "찾았다, 그만!"이 필요할 때 써. `while True:`(일부러 만든 무한루프) + `break`는 아주 흔한 짝꿍이야.

```python run
n = 91
i = 2
while True:
    if n % i == 0:
        break           # 처음 나누어떨어지는 수를 찾으면 탈출
    i += 1
print("91을 처음 나누는 수:", i)
```

## `continue`: 이번 바퀴만 건너뛰기

`continue`를 만나면 블록의 나머지를 건너뛰고 **다음 바퀴**로 가. `for`에서도 똑같이 쓸 수 있어.

```python run
for i in range(1, 11):
    if i % 3 == 0:
        continue        # 3의 배수는 건너뛰기
    print(i, end=" ")
print()
```

```js compare
for (let i = 1; i <= 10; i++) {
  if (i % 3 === 0) continue;   // break, continue는 JS와 똑같아!
}
// 다만 Python에는 do { ... } while (조건); 이 없어.
// "일단 한 번은 실행"이 필요하면 while True: ... if 조건: break 로 써.
```

## 미니 연습

1부터 10까지 출력하되 3의 배수만 건너뛰도록, 빈칸에 '이번 바퀴만 건너뛰는' 주문을 적어 봐!
