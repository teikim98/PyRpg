# 짐 검사의 주문: 집합

창고 거리 검문소에서는 '이 화물이 금지 목록에 있나?'를 하루에 수천 번 물어. 이럴 때 쓰는 게 **집합**(`set`)이야. 같은 값은 **하나만** 담고, 들어 있는지 **아주 빨리** 알려 주는 주머니야.

## 만들기와 넣고 빼기

`{값, 값}`이나 `set(리스트)`로 만들어. 같은 값은 자동으로 하나만 남아. 넣기는 `add`, 빼기는 `discard`(없어도 괜찮음)와 `remove`(없으면 KeyError).

```python run
cargo = ["salt", "rope", "salt", "tea", "rope"]
kinds = set(cargo)            # 중복이 사라짐
print(len(kinds))             # 종류 수: 3
print(sorted(kinds))          # 출력할 땐 sorted로 줄 세우기
kinds.add("silk")
kinds.add("salt")             # 이미 있으면 그대로
kinds.discard("tea")          # 빼기
kinds.discard("gold")         # 없어도 에러 없음
print(sorted(kinds))
print("silk" in kinds, "tea" in kinds)
```

```js compare
const kinds = new Set(cargo);
kinds.size;            // ← Python: len(kinds)
kinds.has("silk");     // ← Python: "silk" in kinds
kinds.delete("tea");   // ← Python: kinds.discard("tea")
```

## 빈 집합은 `set()`, `{}`는 딕셔너리!

여기서 많이 넘어져. `{}`는 **빈 딕셔너리**야. 빈 집합은 꼭 `set()`으로 만들어야 해. `{}`로 만들고 `add`를 부르면 딕셔너리에는 `add`가 없어서 폭발해.

```python run
a = {}
b = set()
print(type(a), type(b))
try:
    a.add("salt")
except AttributeError as e:
    print("AttributeError:", e)
b.add("salt")
print(len(b))
```

## `in`이 빠른 이유

리스트에서 `x in arr`는 앞에서부터 하나씩 비교해. 길이가 10만이면 10만 번 볼 수도 있지. 집합은 값마다 자리를 미리 정해 두고 그 자리만 확인하니까, 크기와 상관없이 거의 한 번에 끝나. 검사할 게 많으면 리스트를 집합으로 바꿔 두는 게 좋아. (이게 얼마나 큰 차이인지는 나중에 더 깊이 볼 거야!)

## 교집합·합집합·차집합

두 배의 화물 목록을 비교할 때 딱 좋아. `&`는 **둘 다** 있는 것, `|`는 **하나라도** 있는 것, `-`는 **앞에만** 있는 것이야. 결과도 집합이고, 집합에는 **순서가 없어**. 출력하기 전에 `sorted`로 줄 세우는 습관을 들이자.

```python run
ship_a = {"salt", "rope", "tea", "silk"}
ship_b = {"tea", "fish", "salt"}
print(sorted(ship_a & ship_b))    # 둘 다 실은 것
print(sorted(ship_a | ship_b))    # 둘 중 하나라도
print(sorted(ship_a - ship_b))    # a에만 있는 것
print(len(ship_a & ship_b))
```

```js compare
// JS Set에는 교집합 연산자가 없어서 직접 걸러야 해
[...a].filter((x) => b.has(x));   // ← Python: a & b
```

- 집합에 들어가는 값도 dict 키처럼 바뀌지 않는 값(문자열·숫자·튜플)이어야 해.
- `print(kinds)`처럼 집합을 그대로 출력하면 순서가 실행할 때마다 다를 수 있어. 답으로 낼 땐 언제나 `sorted(kinds)`!

## 미니 연습

두 배가 **둘 다** 실은 화물만 골라 `['salt', 'tea']`가 출력되도록 빈칸에 연산자를 채워 봐.
