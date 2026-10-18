# 되울림의 주문: 재귀

안개 갈대밭에서 소리를 지르면, 메아리가 메아리를 부르며 점점 작아지다가 마지막엔 조용해져. 함수도 그렇게 **자기 자신을 부를** 수 있어. 이걸 **재귀**라고 해. 재귀의 약속은 딱 두 가지야.

1. **기저 조건**: 더 쪼개지 않고 바로 답을 아는 가장 작은 경우. 여기서 메아리가 멈춰.
2. **더 작은 문제**: 자기 자신을 부를 때는 반드시 문제를 더 작게 만들어서 불러. 그래야 언젠가 기저 조건에 닿아.

## 팩토리얼과 자릿수 합

`fact(5)`는 `5 * fact(4)`, `fact(4)`는 `4 * fact(3)`… 이렇게 내려가다 `fact(1)`에서 멈춰. 자릿수 합도 마찬가지로 '마지막 자리 + 나머지 자리들의 합'으로 쪼갤 수 있어.

```python run
def fact(n):
    if n <= 1:               # 기저 조건: 바로 답
        return 1
    return n * fact(n - 1)   # 더 작은 문제를 부름
print(fact(5))               # 120

def digit_sum(n):
    if n < 10:               # 한 자리면 그 자체가 답
        return n
    return digit_sum(n // 10) + n % 10
print(digit_sum(2024))       # 2 + 0 + 2 + 4 = 8
```

```js compare
function fact(n) {        // 재귀는 JS와 완전히 같아
  if (n <= 1) return 1;
  return n * fact(n - 1);
}
// 너무 깊으면 JS: RangeError: Maximum call stack size exceeded
//          Python: RecursionError: maximum recursion depth exceeded
```

## 메아리를 따라가 보기

재귀가 어떻게 내려갔다 올라오는지 들여쓰기로 찍어 보자. 부를 때마다 한 칸씩 깊어지고, 기저 조건에서 돌아오기 시작해. 먼저 부른 함수는 안쪽 함수가 값을 돌려줄 때까지 **기다려**.

```python run
def echo(n, depth=0):
    pad = "  " * depth
    print(pad + f"echo({n}) 부름")
    if n == 0:
        print(pad + "바닥! 0을 돌려줌")
        return 0
    result = echo(n - 1, depth + 1) + n
    print(pad + f"echo({n}) = {result} 돌려줌")
    return result

echo(3)
```

## 반으로 나눠 풀기

재귀는 문제를 **반으로 쪼개서** 각각 풀고 합치는 데도 좋아. 가장 큰 값을 왼쪽 절반과 오른쪽 절반에서 따로 찾고 둘 중 큰 쪽을 고르는 식이야. 연잎 탑 옮기기(하노이의 탑)도 '위의 n-1개를 옆으로 → 맨 아래 하나를 목표로 → n-1개를 다시 위로'라는 같은 모양의 작은 문제로 쪼개져.

```python run
def biggest(arr, lo, hi):          # arr[lo]~arr[hi] 중 가장 큰 값
    if lo == hi:                    # 한 칸이면 그게 답
        return arr[lo]
    mid = (lo + hi) // 2
    left = biggest(arr, lo, mid)
    right = biggest(arr, mid + 1, hi)
    return max(left, right)

depths = [4, 9, 2, 7, 5]
print(biggest(depths, 0, len(depths) - 1))   # 9

def hanoi(n, start, via, goal):
    if n == 0:                      # 옮길 연잎이 없으면 끝
        return
    hanoi(n - 1, start, goal, via)  # 위의 n-1개를 잠깐 옆으로
    print(f"{n}번 연잎: {start} → {goal}")
    hanoi(n - 1, via, start, goal)  # 옆에 둔 n-1개를 목표로

hanoi(2, "A", "B", "C")
```

## 함수 안의 함수

재귀 도우미 함수는 `solution` **안에** 만들어도 돼. 그러면 `solution`이 받은 리스트를 인자로 일일이 넘기지 않아도 안쪽 함수가 바로 읽을 수 있어. 다만 안쪽 함수에서 바깥 값을 **고칠** 때는 이름에 새로 담지 말고 리스트(나 dict)의 **칸**을 바꿔. `total += nums[i]`처럼 이름에 새로 담으면 부름의 비석에서 본 `UnboundLocalError`가 나거든.

```python run
def solution(nums):
    total = [0]                  # 고칠 값은 리스트 칸에 담아 둠

    def visit(i):                # solution 안에 만든 도우미 함수
        if i == len(nums):       # 바깥 nums를 그대로 읽음
            return
        if nums[i] > 0:
            total[0] += nums[i]  # 이름이 아니라 칸을 고침
        visit(i + 1)

    visit(0)
    return total[0]

print(solution([3, -1, 4, -1, 5]))   # 3 + 4 + 5 = 12
print(solution([-2, -8]))            # 0
```

```js compare
function solution(nums) {
  let total = 0;
  function visit(i) {        // 함수 안의 함수(클로저)는 JS와 같아
    total += nums[i];        // JS는 바깥 let을 바로 바꿀 수 있지만,
  }                          // Python은 이렇게 쓰면 UnboundLocalError → total = [0]의 칸을 고쳐
}
```

## 기저 조건을 빠뜨리면: `RecursionError`

기저 조건이 없거나 문제가 작아지지 않으면 함수가 끝없이 자기를 불러. Python은 일정 깊이(기본 약 1000)에서 `RecursionError`를 내고 멈춰. 아래 블록은 에러를 보려고 `try`/`except`로 감쌌어.

```python run
def forever(n):
    return forever(n + 1)      # 기저 조건이 없다!

try:
    forever(0)
except RecursionError:
    print("RecursionError: 메아리가 끝나지 않아!")

def countdown(n):
    if n == 0:                 # 기저 조건
        return "발사!"
    return countdown(n - 1)    # 매번 1씩 작아짐
print(countdown(200))          # 깊이 200 정도는 괜찮아
```

## 브라우저와 실제 시험의 재귀 한도는 달라

- Python은 실제 시험 환경에서도 기본으로 깊이 약 1000에서 멈춰. 그래서 깊이가 수천~수만이 될 수 있는 시험 문제에서는 코드 맨 위에 아래 두 줄을 적는 게 흔한 습관이야.

```python
import sys
sys.setrecursionlimit(10 ** 6)   # 실제 시험에서 깊은 재귀가 필요할 때
```

- 그런데 이 게임은 **브라우저 안에서** Python을 돌려서 한도가 또 달라. 특히 다음 비석에서 배울 `lru_cache`처럼 내장 기능을 거치는 재귀는 깊이 수백에서 실행 환경이 멈춰 버릴 수 있어. 그래서 이 호수의 문제는 재귀 깊이가 300을 넘지 않게 냈어.
- 아주 깊어야 하는 재귀는 반복문으로 바꾸는 게 어디서든 가장 안전해.

## 미니 연습

`total(4)`가 `4 + 3 + 2 + 1 = 10`을 돌려주도록, 기저 조건에서 돌려줄 값을 빈칸에 채워 봐.
