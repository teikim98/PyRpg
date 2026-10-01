# 줄 세우기의 주문: 리스트

이 동굴 좀 봐! 고블린들이 보물을 전부 **한 줄로** 쌓아 뒀어. 내 지도에도 동굴이 칸칸이 나뉜 보물 선반으로 그려져 있고. 여러 값을 한 줄로 묶어 두는 주문이 바로 **리스트**야.

## 리스트 만들기와 칸 번호

대괄호 `[]` 안에 값을 쉼표로 늘어놓으면 리스트야. 칸 번호(인덱스)는 JS 배열처럼 **0부터** 세.

```python run
treasures = [50, 20, 70, 10]
print(treasures)
print(treasures[0])     # 맨 앞
print(treasures[2])     # 세 번째
print(len(treasures))   # 길이는 len()
```

```js compare
const treasures = [50, 20, 70, 10];
treasures[0];          // 50
treasures.length;      // 4   ← Python: len(treasures)
```

> 길이가 n이면 칸 번호는 `0`부터 `n - 1`까지야. `treasures[len(treasures)]`는 줄 바깥이라 `IndexError`가 나. JS는 조용히 `undefined`를 주지만 Python은 바로 알려 줘.

## 음수 인덱스: 뒤에서부터 세기

Python에는 JS에 없는 편리한 번호가 있어. **음수**를 쓰면 뒤에서부터 세. `-1`은 맨 끝, `-2`는 끝에서 두 번째.

```python run
treasures = [50, 20, 70, 10]
print(treasures[-1])    # 10
print(treasures[-2])    # 70
treasures[1] = 99       # 칸에 새 값 넣기
print(treasures)
```

```js compare
treasures[treasures.length - 1];  // JS에서 맨 끝 (또는 treasures.at(-1))
// Python: treasures[-1]
```

## `in`으로 찾기

`값 in 리스트`는 있으면 `True`, 없으면 `False`. 없는지 물을 땐 `not in`.

```python run
treasures = [50, 20, 70, 10]
print(70 in treasures)
print(33 in treasures)
print(33 not in treasures)
```

## 한 줄 입력을 리스트로

백준식 입력 `3 1 4 1 5`를 정수 리스트로 바꾸는 단골 주문이야. 여기서는 `input()` 대신 문자열 하나로 흉내 내 볼게.

```python run
line = "3 1 4 1 5"                  # input()이 이런 문자열을 준다고 치고
nums = list(map(int, line.split()))
print(nums)
print(*nums)                         # * 를 붙이면 공백으로 풀어서 출력
```

- 실제 문제에서는 `list(map(int, input().split()))`이라고 써.
- `print(*nums)`는 `print(3, 1, 4, 1, 5)`와 같아. 리스트를 백준 출력 모양(공백 구분)으로 낼 때 아주 자주 써.

## 미니 연습

`arr`의 **맨 끝** 값이 출력되도록 빈칸을 채워 봐. 길이를 몰라도 되는 번호가 있었지?
