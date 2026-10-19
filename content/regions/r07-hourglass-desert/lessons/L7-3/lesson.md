# 찾음의 주문: set과 dict로 빨리 찾기

신기루 시장에는 상인도 물건도 수만 개야. "이게 목록에 있나?"를 물을 때마다 목록을 처음부터 끝까지 훑으면, 모래시계의 비석에서 본 숨은 `O(N)`이 반복마다 쌓여. 교역항에서 배운 set과 dict가 여기서 진짜 힘을 내. **찾기가 거의 한 번에 끝나거든.**

## list의 `in`은 `O(N)`, set·dict의 `in`은 평균 `O(1)`

리스트는 `x in arr`를 물으면 앞에서부터 하나씩 비교해. set과 dict는 값을 넣을 때 그 값으로 **번호표(해시)**를 계산해서 그 칸에 바로 넣어 둬. 찾을 때도 번호표만 다시 계산해서 그 칸을 보면 되니까, 원소가 백만 개여도 **평균 한두 번**이면 끝나.

| 질문 Q개, 목록 N개 | 리스트로 찾기 | set으로 찾기 |
|---|---|---|
| 한 번 찾기 | `O(N)` | 평균 `O(1)` |
| Q번 찾기 | `O(N × Q)` | `O(N + Q)`(set 만들기 N + 찾기 Q) |

```python run
n = 200000
q = 200000
print("리스트로 Q번 찾기:", n * q, "번 비교(최악)")
print("set으로 Q번 찾기:", n + q, "번 정도")
print("어림(1초에 천만 번):", n * q // 10 ** 7, "초 대", (n + q) / 10 ** 7, "초")
```

## 단어장 철자 확인

사막 단어장에 있는 단어만 바른 철자로 치고, 문장에서 틀린 단어를 골라 보자. 단어장을 **반복 밖에서 한 번만** set으로 만들어 두고, 단어마다 `in`으로 물어.

```python run
wordbook = ["sand", "dune", "oasis", "camel", "palm", "star"]
book = set(wordbook)               # 반복 밖에서 딱 한 번
sentence = "camel oasis stra dune plam sand"
wrong = []
for w in sentence.split():
    if w not in book:              # 단어마다 평균 O(1)
        wrong.append(w)
print(wrong)
```

### 함정: 반복 안에서 `set(arr)`을 매번 만들기

`set(arr)`을 만드는 일 자체가 원소 N개를 하나씩 넣는 `O(N)`이야. 그래서 이걸 반복 **안에** 두면 set의 빠른 찾기가 하나도 소용없어지고, 결국 `O(N × Q)`가 돼.

```python
for w in words:
    if w in set(wordbook):         # 질문마다 단어장 전체로 set을 새로 만듦: O(N × Q)!
        ...

book = set(wordbook)               # 반복 밖에서 한 번: O(N)
for w in words:
    if w in book:                  # 질문마다 평균 O(1)
        ...
```

## 본 것을 담는 `seen` set

"이미 본 적 있나?"를 물으며 훑을 때는 빈 set을 하나 두고, 보는 대로 `add`해. 순서를 지키면서 중복을 지우는 일이 한 번 훑기로 끝나.

```python run
caravan = ["salt", "silk", "salt", "dates", "silk", "spice", "salt"]
seen = set()
order = []
for item in caravan:
    if item not in seen:           # 평균 O(1)
        seen.add(item)
        order.append(item)
print(order)                       # 처음 나온 순서 그대로
print(len(caravan), "개 중 서로 다른 것", len(seen), "개")
```

`set(caravan)`도 중복을 지워 주지만 순서를 지키지 않아. 순서가 중요하면 `seen` set과 리스트를 함께 써.

## 개수를 세는 dict(교역항 복습)

dict도 키를 찾는 데 평균 `O(1)`이야. 교역항에서 배운 `d[x] = d.get(x, 0) + 1`은 반복 한 번에 모든 값의 개수를 세. 리스트의 `count(x)`를 값마다 부르면 `O(N²)`이지만, dict로 세면 `O(N)`.

```python run
footprints = "camel camel fox camel lizard fox"
count = {}
for animal in footprints.split():
    count[animal] = count.get(animal, 0) + 1
print(count)
print("camel" in count, "snake" in count)   # 키 찾기도 평균 O(1)
print(count.get("snake", 0))
```

## 집합 내포와 dict 내포

리스트 내포 `[식 for x in arr]`의 대괄호를 중괄호로 바꾸면 **집합 내포** `{식 for x in arr}`가 돼. `{키: 값 for x in arr}`처럼 콜론을 넣으면 **dict 내포**야. set이나 dict를 한 줄로 만들 때 편해.

```python run
names = ["Ann", "bo", "ANN", "Cy", "bo"]
lower_set = {name.lower() for name in names}      # 집합 내포: 중복은 하나로
print(sorted(lower_set))

lengths = {name: len(name) for name in ["oasis", "dune", "palm"]}   # dict 내포
print(lengths)

stalls = ["spice", "rug", "lamp"]
where = {name: i for i, name in enumerate(stalls)}   # 이름 → 자리 번호
print(where["lamp"], "rug" in where)
```

- 빈 `{}`는 set이 아니라 **빈 dict**야(교역항). 빈 set은 `set()`.
- 내포에도 `if`를 붙일 수 있어: `{w for w in words if len(w) > 3}`.

```js compare
const book = new Set(wordbook);      // ← Python: book = set(wordbook)
book.has("dune");                    // ← Python: "dune" in book
const count = new Map();             // ← Python: count = {}
count.set(k, (count.get(k) ?? 0) + 1);   // ← count[k] = count.get(k, 0) + 1
// JS의 Set·Map도 해시로 찾아서 평균 O(1). arr.includes(x)는 O(N)
```

## 미니 연습

대소문자만 다른 이름은 같은 이름으로 치고, 서로 다른 이름이 몇 개인지 세어 봐. 빈칸에 집합 내포의 낱말 하나를 채우면 돼.
