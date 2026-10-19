# 체의 주문: 소수와 에라토스테네스의 체

별자리 유적의 돌판에는 수가 잔뜩 새겨져 있고, 어떤 수 위에서만 별이 빛나. 그 수들이 바로 **소수**야. 소수는 **1과 자기 자신으로만 나누어떨어지는 2 이상의 정수**야. 2, 3, 5, 7, 11, 13… 그리고 **1은 소수가 아니야.** 수 하나를 판정하는 법과, 많은 수를 한꺼번에 판정하는 '체'를 배워 보자.

## 하나씩 판정: √N까지만 나눠 보기

n이 소수인지 보려면 2부터 나눠 보다가 나누어떨어지는 수가 하나라도 있으면 소수가 아니야. 그런데 n - 1까지 다 나눠 볼 필요는 없어. 약수는 **짝**을 지어 나오거든. 36이면 2 × 18, 3 × 12, 4 × 9, 6 × 6. 짝의 작은 쪽은 언제나 √n 이하야(갈림길 숲의 수호목과 약수를 셀 때 본 그 성질!). 그래서 `i * i <= n`인 동안만 나눠 보면 돼. n이 10억이어도 3만 번 남짓이면 끝나는 `O(√N)` 판정이야.

```python run
n = 36
i = 1
while i * i <= n:
    if n % i == 0:
        print(i, "×", n // i)      # 짝의 작은 쪽 i는 √36 = 6 이하
    i += 1
```

이 방법으로 30 이하의 소수를 모두 찍어 보자.

```python run
for n in range(2, 31):
    prime = True
    i = 2
    while i * i <= n:             # 끝 조건은 <= (같을 때도 나눠 봐야 해)
        if n % i == 0:
            prime = False
            break
        i += 1
    if prime:
        print(n, end=" ")
print()
```

- 끝 조건을 `i * i < n`으로 쓰면 49 = 7 × 7처럼 **짝이 같은 수**(완전제곱수)에서 7을 나눠 보지 못해서 49를 소수로 잘못 봐. `<=`가 꼭 필요해.
- `range(2, n)`으로 끝까지 나눠 보는 건 n이 10억이면 10억 번이라 너무 느려.
- 0과 1은 반복에 들어가기 전에 따로 "소수 아님"으로 걸러 내.

## `import math`: `math.isqrt`와 `math.sqrt`

`import math`를 하면 수학 도구 묶음 `math`를 쓸 수 있어. `math.isqrt(n)`은 √n을 **정수로 내림**한 값을 줘. `math.sqrt(n)`은 실수(float)로 계산하는데, 실수는 아주 큰 수에서 끝자리가 반올림돼서 어긋날 수 있어. 정수의 제곱근이 필요하면 `math.isqrt`를 쓰자.

```python run
import math

print(math.isqrt(49), math.isqrt(50), math.sqrt(50))
n = 10 ** 16 - 1                  # 9999999999999999
print(math.sqrt(n))               # 100000000.0: 실수가 반올림해서 커짐!
print(int(math.sqrt(n)) ** 2 <= n)   # False: 제곱하면 n을 넘어
print(math.isqrt(n), math.isqrt(n) ** 2 <= n)   # 99999999 True
```

`while i * i <= n:` 대신 `for i in range(2, math.isqrt(n) + 1):`로 써도 같은 범위를 돌아. 어느 쪽이든 정수로만 계산하니까 안전해.

## 에라토스테네스의 체

수가 하나면 √N 판정으로 충분하지만, **수가 아주 많으면** 매번 처음부터 나눠 보는 게 쌓이고 쌓여. 이럴 땐 소수 표를 **한 번** 만들어 두고 표를 보기만 해. 이 표를 만드는 방법이 **에라토스테네스의 체**야.

1. `[True] * (n + 1)`로 0부터 n까지 "소수일지도" 표시를 해 둬. 0과 1은 바로 `False`.
2. 2부터 보면서, 아직 `True`인 수 `i`를 만나면 `i`는 소수야. 그 배수들을 체로 걸러 내듯 `False`로 지워.
3. 지우기는 `i * i`부터 `i`씩 건너뛰며. `i * 2`, `i * 3`… 처럼 그보다 작은 배수는 더 작은 소수가 이미 지웠거든.
4. `i * i`가 n보다 커지면 더 지울 게 없어. 남은 `True`가 모두 소수!

```python run
n = 100
is_prime = [True] * (n + 1)
is_prime[0] = False
is_prime[1] = False
i = 2
while i * i <= n:
    if is_prime[i]:
        for j in range(i * i, n + 1, i):   # i*i부터 i씩 건너뛰며 지우기
            is_prime[j] = False
    i += 1

primes = [k for k in range(n + 1) if is_prime[k]]
print(len(primes), "개:", primes)
print(is_prime[97], is_prime[91])          # 표를 보면 바로 답: 91 = 7 × 13
```

표를 만든 뒤에는 "이 수가 소수야?"를 `is_prime[x]` 한 번으로 답해. 20 이하의 합성수(소수가 아닌 2 이상의 수)를 세는 것도 표만 보면 끝이야.

```python run
n = 20
is_prime = [True] * (n + 1)
is_prime[0] = is_prime[1] = False
for i in range(2, n + 1):
    if i * i > n:
        break
    if is_prime[i]:
        for j in range(i * i, n + 1, i):
            is_prime[j] = False
composite = [k for k in range(2, n + 1) if not is_prime[k]]
print(len(composite), composite)
```

- 체를 만드는 데 드는 일은 `O(N log log N)`으로, 사실상 N에 가까워. 한 번 만들면 판정은 하나에 `O(1)`.
- 체는 0부터 N까지 칸을 모두 만들어야 해서 **메모리**가 한계야. 10^7 안팎까지는 괜찮지만, 10^12처럼 큰 수는 칸을 만들 수조차 없어. 그땐 수 하나하나를 √N 판정으로.
- **판정할 수가 많고 최댓값이 적당하면 체, 수가 적거나 아주 크면 √N 판정.** 이 선택이 시간을 가르는 핵심이야.

```js compare
const isPrime = new Array(n + 1).fill(true);  // ← Python: [True] * (n + 1)
for (let i = 2; i * i <= n; i++) {            // ← 같은 알고리즘, 같은 끝 조건
  if (isPrime[i]) for (let j = i * i; j <= n; j += i) isPrime[j] = false;
}
Math.sqrt(1e16 - 1);   // 100000000: JS 숫자도 실수라 똑같이 어긋나
// Python은 math.isqrt로 정수 제곱근을 바로 구할 수 있어
```

## 미니 연습

50 이하의 소수를 체로 세어 봐. 빈칸에 지울 배수의 **건너뛰는 간격**을 채우면 소수 `15`개가 나와야 해.
