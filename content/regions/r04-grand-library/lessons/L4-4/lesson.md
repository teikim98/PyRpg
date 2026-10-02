# 글자 번호의 주문: 아스키 코드

필사실의 필경사들은 글자를 번호로 적어 뒀어. 컴퓨터 속 글자에는 모두 번호가 있거든. `a`는 97, `b`는 98, …, `z`는 122. 대문자 `A`는 65부터 `Z` 90까지. 이 번호를 다루는 주문이 `ord`와 `chr`이야.

## ord와 chr

- `ord(글자)`: 글자 → 번호
- `chr(번호)`: 번호 → 글자

```python run
print(ord("a"), ord("z"))
print(ord("A"), ord("Z"))
print(chr(97), chr(65))
print(chr(ord("a") + 2))     # a에서 두 칸 뒤: c
```

```js compare
"a".charCodeAt(0);          // 97    ← Python: ord("a")
String.fromCharCode(97);    // "a"   ← Python: chr(97)
```

## 0~25 칸 번호로 바꾸기

`ord(c) - ord("a")`를 하면 `a`는 0, `b`는 1, …, `z`는 25가 돼. 알파벳마다 칸이 하나씩 있는 리스트 `[0] * 26`과 같이 쓰면 글자 수를 셀 수 있어.

```python run
word = "banana"
cnt = [0] * 26
for c in word:
    cnt[ord(c) - ord("a")] += 1
print(cnt[0], cnt[1], cnt[13])   # a, b, n의 개수
print(*cnt)
```

> 대문자에 `ord(c) - ord("a")`를 쓰면 `ord("A") - 97 = -32`처럼 음수가 나와. 대문자는 `ord(c) - ord("A")`로 따로 계산해야 해.

## 알파벳 밀기와 % 26

글자를 k칸 뒤로 미는 암호를 생각해 봐. `z`를 한 칸 밀면 `a`로 돌아와야 하는데, 그냥 `chr(ord("z") + 1)`을 하면 `{`가 나와. 그래서 0~25 칸 번호로 바꾼 다음 `% 26`으로 한 바퀴 돌려.

```python run
c = "z"
print(chr(ord(c) + 1))                            # { (실수!)
k = 3
idx = (ord(c) - ord("a") + k) % 26                # 25 + 3 = 28 → 2
print(chr(idx + ord("a")))                         # c
up = "Y"
print(chr((ord(up) - ord("A") + k) % 26 + ord("A")))   # 대문자는 A 기준: B
```

## 대소문자 판별

`c.isupper()`, `c.islower()`로 물어봐도 되고, 번호 범위로 확인해도 돼. 숫자·기호·공백은 대문자도 소문자도 아니야.

```python run
for c in "aZ3 !":
    if c.isupper():
        print(f"[{c}] 대문자")
    elif c.islower():
        print(f"[{c}] 소문자")
    else:
        print(f"[{c}] 글자가 아님")
print("A" <= "Q" <= "Z")      # 문자열 비교도 번호 순서
```

## 미니 연습

`a`에서 세 칸 뒤의 글자 `d`가 출력되게 빈칸에 숫자를 채워 봐.
