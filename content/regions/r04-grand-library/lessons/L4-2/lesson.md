# 글자 다듬기의 주문: 문자열 메서드

열람실 책들은 제목이 엉망이야. 앞뒤에 공백이 붙고, 대문자 소문자가 섞이고, 밑줄이 끼어 있고. 이걸 다듬는 도구가 **문자열 메서드**야. `문자열.메서드()` 모양으로 불러.

## 바꾼 결과는 '새 문자열'로 돌아와

문자열은 불변이니까, 메서드는 원래 문자열을 고치지 않고 **새 문자열을 돌려줘**. 그래서 꼭 변수에 다시 담아야 해. 열람실 비석 낙서의 사연이 바로 이거야.

```python run
title = "  The Lost Book  "
title.upper()                 # 결과를 버림. title은 그대로!
print("[" + title + "]")
title = title.strip()         # 앞뒤 공백 떼기, 다시 담기
print("[" + title + "]")
print(title.upper())          # 전부 대문자
print(title.lower())          # 전부 소문자
```

```js compare
title.trim();          // ← Python: title.strip()
title.toUpperCase();   // ← Python: title.upper()
title.toLowerCase();   // ← Python: title.lower()
```

> JS 손버릇으로 `title.toUpperCase()`나 `title.length`를 쓰면 `AttributeError: 'str' object has no attribute ...`가 나. Python 이름은 `upper()`, `len(title)`이야.

## 바꾸기, 찾기, 세기

- `s.replace(a, b)`: `a`를 **전부** `b`로 바꾼 새 문자열. JS의 `replaceAll`이랑 같아(JS `replace`는 첫 하나만 바꾸지).
- `s.find(x)`: `x`가 처음 나오는 칸 번호. 없으면 `-1`. JS의 `indexOf`야.
- `s.count(x)`: `x`가 몇 번 나오는지. 왼쪽부터 **겹치지 않게** 세.

```python run
s = "the_lost_book"
print(s.replace("_", " "))    # 밑줄을 전부 공백으로
print(s.find("o"))            # 처음 나오는 o의 칸 번호
print(s.find("z"))            # 없으면 -1
print(s.count("o"))
print("aaaa".count("aa"))     # 겹치지 않게 세서 2
```

```js compare
s.replaceAll("_", " ");   // ← Python: s.replace("_", " ")
s.indexOf("o");           // ← Python: s.find("o")
```

> 비슷한 `s.index(x)`도 있는데, 없을 때 `-1` 대신 `ValueError: substring not found`를 내. "없을 수도 있다"면 `find`가 안전해.

## 묻는 메서드: True / False

- `s.startswith(x)`, `s.endswith(x)`: `x`로 시작하는지, 끝나는지.
- `s.isdigit()`: 전부 숫자인지. `s.isalpha()`: 전부 글자인지. `s.isupper()`: 대문자인지(`islower()`도 있어).

```python run
name = "Scroll42"
print(name.startswith("Sc"), name.endswith("42"))
print("42".isdigit(), "4a".isdigit())
print("abc".isalpha(), "ab c".isalpha())
for c in name:
    if c.isupper():
        print(c, "는 대문자")
    elif c.isdigit():
        print(c, "는 숫자")
```

메서드는 이어서 쓸 수도 있어. `title.strip().lower()`는 공백을 떼고, 그 결과를 소문자로 바꿔.

## 미니 연습

`title`의 앞뒤 공백을 떼어서 `[ancient tome]`이 출력되게, 빈칸에 메서드 이름을 채워 봐.
