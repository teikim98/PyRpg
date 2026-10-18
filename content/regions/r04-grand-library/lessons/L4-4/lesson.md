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

`ord(c) - ord("a")`를 하면 `a`는 0, `b`는 1, …, `z`는 25가 돼. 글자마다 0부터 시작하는 칸 번호가 생기는 거야.

```python run
print(ord("n") - ord("a"))       # 13: n은 13번 칸
```

칸 번호가 생기면 리스트로 **개수를 셀** 수 있어. 먼저 숫자 글자로 해 볼까? `"0"`~`"9"`는 `int(ch)`가 바로 0~9 칸 번호야. 칸이 10개인 `[0] * 10`을 만들어 두고, 숫자 글자를 만날 때마다 그 칸을 1씩 올려.

```python run
code = "a1b2-2026"
cnt = [0] * 10
for ch in code:
    if ch.isdigit():
        cnt[int(ch)] += 1
print(cnt[2], cnt[0])            # 2는 3번, 0은 1번
print(*cnt)
```

알파벳도 생각은 같아. 칸이 몇 개 필요한지, 글자를 몇 번 칸에 넣을지만 달라져.

> 대문자에 `ord(c) - ord("a")`를 쓰면 `ord("A") - 97 = -32`처럼 음수가 나와. 대문자는 기준 글자를 `"A"`로 바꿔야 해.

## 알파벳 밀기와 % 26

글자를 몇 칸 뒤로 미는 암호를 생각해 봐. `z`를 한 칸 밀면 `a`로 돌아와야 하는데, 그냥 `chr(ord("z") + 1)`을 하면 `{`가 나와. 그래서 0~25 칸 번호로 바꿔서 더한 다음 `% 26`으로 한 바퀴 돌려. 26으로 나눈 나머지는 언제나 0~25라서, 25를 넘으면 다시 0부터야.

```python run
print(chr(ord("z") + 1))         # { (실수!)
idx = ord("y") - ord("a")        # y는 24번 칸
idx = (idx + 3) % 26             # 3칸 밀기: 27 → 1
print(chr(idx + ord("a")))       # b
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
