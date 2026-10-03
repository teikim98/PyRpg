# 셈의 주문: Counter와 defaultdict

장부의 주문으로 `d[x] = d.get(x, 0) + 1`을 매번 쓰는 건 좀 귀찮지? Python에는 세기와 묶기를 대신해 주는 도구 상자 `collections`가 있어. 상자에서 꺼내 쓰려면 먼저 **불러와야**(import) 해.

```python
from collections import Counter, defaultdict
```

이 줄을 빠뜨리면 `NameError: name 'Counter' is not defined`가 나. `sys`를 쓰려면 `import sys`가 필요했던 것처럼!

## Counter: 한 줄로 세기

`Counter(리스트)`는 값마다 몇 개인지 센 장부(dict의 일종)를 만들어 줘. 문자열을 넣으면 글자를 세. **없는 값을 물어보면 KeyError 대신 0**을 돌려주는 게 보통 dict와 다른 점이야.

```python run
from collections import Counter
cargo = ["salt", "rope", "salt", "tea", "salt", "rope"]
c = Counter(cargo)
print(c["salt"], c["rope"])   # 3 2
print(c["silk"])              # 없으면 0 (KeyError 아님!)
print(len(c))                 # 종류 수
print(Counter("banana")["a"]) # 글자 세기: 3
for name, n in c.items():     # dict처럼 돌 수 있어
    print(name, n)
```

```js compare
// JS에서는 reduce로 직접 세야 했지
cargo.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
// ← Python: Counter(cargo)
```

## `most_common`: 많은 순서대로

`c.most_common(k)`는 많은 것부터 k개를 `(값, 개수)` **튜플의 리스트**로 줘. 하나만 달라고 해도 리스트야! 값만 꺼내려면 `[0][0]`, 개수는 `[0][1]`.

```python run
from collections import Counter
c = Counter(["salt", "rope", "salt", "tea", "salt", "rope"])
print(c.most_common(2))       # [('salt', 3), ('rope', 2)]
top = c.most_common(1)
print(top)                    # [('salt', 3)]  ← 리스트 안의 튜플
name, n = top[0]              # 풀어서 꺼내기
print(name, n)
```

> 개수가 같으면 `most_common`은 **먼저 센 것**을 앞에 둬. '같으면 사전순'처럼 다른 규칙이 필요하면 직접 골라야 해. 예를 들어 가장 큰 개수를 구해 두고, 그 개수인 이름들 중 `min`을 고르면 사전순으로 앞선 이름이야.

## Counter 빼기

Counter끼리 `-`로 빼면 개수를 빼 줘. 0 이하가 된 건 알아서 지워져. '출항한 선원 − 돌아온 선원'처럼 **같은 이름이 여럿인** 명단을 비교할 때 좋아. 집합 빼기는 같은 이름을 하나로 뭉쳐 버리니까 이런 땐 못 써.

```python run
from collections import Counter
left = Counter(["kim", "lee", "kim", "park"])
back = Counter(["kim", "park"])
missing = left - back
print(dict(missing))          # {'kim': 1, 'lee': 1}
print(sorted(missing.elements()))   # 개수만큼 펼치기
print(sorted(set(["kim", "lee", "kim"]) - set(["kim"])))  # 집합 빼기는 kim을 다 지움
```

## defaultdict: 기본값이 있는 장부

`defaultdict(list)`는 없는 키를 처음 건드리면 **빈 리스트를 알아서 만들어 주는** dict야. 그래서 '항구별로 선원 묶기' 같은 걸 `if` 없이 쓸 수 있어. `defaultdict(int)`는 기본값 0, `defaultdict(set)`은 빈 집합이야.

```python run
from collections import defaultdict
crew = [("ann", "north"), ("bo", "south"), ("cy", "north")]
by_port = defaultdict(list)
for name, port in crew:
    by_port[port].append(name)     # 처음 보는 port면 []부터
print(dict(by_port))
count = defaultdict(int)
for name, port in crew:
    count[port] += 1               # 처음 보는 port면 0부터
print(dict(count))
plain = {}
try:
    plain["north"].append("ann")   # 보통 dict는 KeyError
except KeyError as e:
    print("KeyError:", e)
```

- `Counter`는 세기, `defaultdict(list)`는 묶기. 둘 다 dict라서 `items()`, `in`, `len`이 그대로 돼.
- 출력 순서가 중요하면 `sorted(d)`로 키를 줄 세워서 돌자.

## 미니 연습

`Counter`로 `"banana"`의 글자를 셌어. 빈칸에 글자를 넣어서 `3`이 출력되게 해 봐.
