# 글자 읽기의 주문: 문자열

이 도서관 좀 봐! 책마다 글자가 줄줄이 적혀 있어. 글자들이 한 줄로 늘어선 값, 그게 **문자열**(`str`)이야. 그런데 동굴에서 배운 리스트랑 다루는 법이 거의 똑같아. 번호로 꺼내고, 자르고, 하나씩 훑고.

## 인덱싱과 길이

문자열의 글자도 칸 번호(인덱스)가 **0부터** 붙어 있어. 음수 번호는 뒤에서부터 세고. 길이는 `len()`이야.

```python run
title = "library"
print(title[0])       # 맨 앞 글자
print(title[-1])      # 맨 끝 글자
print(title[2])       # 세 번째 글자
print(len(title))     # 글자 수
```

```js compare
const title = "library";
title[0];          // "l"
title.at(-1);      // "y"   ← Python: title[-1]
title.length;      // 7     ← Python: len(title)
```

> 리스트랑 똑같이 `title[len(title)]`은 줄 바깥이라 `IndexError: string index out of range`가 나. 맨 끝은 `title[-1]`!

## 자르기와 뒤집기

슬라이싱도 리스트와 같아. `[시작:끝]`에서 **끝은 포함하지 않고**, 간격 `-1`을 주면 거꾸로 읽어.

```python run
title = "library"
print(title[0:3])     # lib
print(title[3:])      # rary
print(title[::-1])    # yrarbil
word = "level"
print(word == word[::-1])   # 거꾸로 읽어도 같은지
```

```js compare
title.slice(0, 3);                  // "lib"
[...title].reverse().join("");      // "yrarbil"   ← Python: title[::-1]
```

## `in`과 `for c in s`

`"부분" in s`는 그 글자(또는 글자 묶음)가 들어 있는지 알려 줘. JS의 `includes`야. 그리고 `for c in s`는 글자를 하나씩 꺼내서 돌아.

```python run
spell = "time stops"
print("stop" in spell)      # True
print("go" in spell)        # False
count = 0
for c in spell:
    if c == "t":
        count += 1
print(count)                # t의 개수
```

```js compare
spell.includes("stop");     // true   ← Python: "stop" in spell
for (const c of spell) { }  // ← Python: for c in spell:
```

## 문자열은 고칠 수 없어(불변)

여기서 리스트와 딱 하나 다른 점! 문자열은 **만든 뒤에 글자 한 칸을 바꿀 수 없어**. `title[0] = "L"`이라고 쓰면 바로 에러가 나. 아래 블록은 에러 메시지만 보려고 `try`/`except`(에러를 받아 내는 주문, 나중에 배워)로 감쌌어.

```python run
title = "library"
try:
    title[0] = "L"
except TypeError as e:
    print("TypeError:", e)
new_title = "L" + title[1:]    # 고치고 싶으면 새 문자열을 만든다
print(new_title)
print(title)                   # 원래 문자열은 그대로
```

- `'str' object does not support item assignment`는 "문자열은 칸에 값을 넣을 수 없어"라는 뜻이야.
- JS 문자열도 똑같이 불변이야. JS에서 `title[0] = "L"`은 (엄격 모드가 아니면) 에러 없이 **조용히 무시**되지만, Python은 언제나 에러로 알려 줘.
- 그래서 고치려면 `"L" + title[1:]`처럼 **새 문자열**을 만들어야 해. 글자를 여러 번 고쳐야 한다면 더 좋은 방법이 있어. 엮고 푸는 주문(L4-3)에서 알려 줄게!

## 미니 연습

`word`를 거꾸로 읽은 문자열이 출력되도록 빈칸에 슬라이스를 채워 봐.
