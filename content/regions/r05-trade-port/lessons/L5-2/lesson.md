# 장부의 주문: 딕셔너리

상인 길드의 장부는 '품목 이름 → 값'으로 적혀 있어. 이름표(**키**)를 붙여 두고 이름표로 값을 찾는 자료형, 그게 **딕셔너리**(`dict`)야. JS의 객체 `{}`나 `Map`이랑 거의 같아.

## 만들기, 찾기, 고치기

`{키: 값, 키: 값}`으로 만들고, `d[키]`로 찾아. 없는 키에 값을 넣으면 새로 추가되고, 있는 키면 값이 바뀌어. `del d[키]`로 지우고, `len(d)`는 키 개수야.

```python run
price = {"salt": 30, "rope": 12}
print(price["salt"])         # 30
price["tea"] = 45            # 새 키 추가
price["rope"] = 15           # 있는 키는 값이 바뀜
del price["salt"]            # 지우기
print(price)
print(len(price))
print("tea" in price, "salt" in price)   # in은 '키'가 있는지 본다
```

```js compare
const price = { salt: 30, rope: 12 };
price.salt;          // ← Python: price["salt"] (점 표기는 안 돼)
"tea" in price;      // ← Python: "tea" in price
delete price.salt;   // ← Python: del price["salt"]
```

## 없는 키는 KeyError, 그래서 `get`

JS 객체는 없는 키를 읽으면 `undefined`가 조용히 나오지만, Python은 **바로 `KeyError`로 폭발해**. 없을 수도 있는 키는 `d.get(키, 기본값)`으로 읽어. 없으면 기본값을 돌려줘. 아래 블록은 에러 메시지만 보려고 `try`/`except`로 감쌌어.

```python run
price = {"salt": 30, "rope": 12}
try:
    print(price["silk"])
except KeyError as e:
    print("KeyError:", e)
print(price.get("silk", 0))       # 없으면 0
print(price.get("salt", 0))       # 있으면 원래 값 30
print(price.get("silk"))          # 기본값을 안 주면 None
if "silk" in price:               # 먼저 in으로 확인해도 돼
    print(price["silk"])
else:
    print("장부에 없음")
```

## 키·값·쌍 돌기

`for k in d`는 **키**를 돌아. 값만 필요하면 `d.values()`, 키와 값을 같이 쓰려면 `d.items()`가 `(키, 값)` 튜플을 주니까 바로 풀어서 써. dict는 **넣은 순서**를 기억해.

```python run
stock = {"salt": 3, "rope": 5, "tea": 1}
for name in stock:
    print(name, end=" ")
print()
print(list(stock.keys()), list(stock.values()))
for name, count in stock.items():
    print(f"{name}: {count}")
print(sum(stock.values()))         # 화물 총수
```

```js compare
Object.keys(stock);       // ← Python: stock.keys()
Object.values(stock);     // ← Python: stock.values()
Object.entries(stock);    // ← Python: stock.items()
```

## 세기와 뒤집기

장부 정리의 기본은 **세기**야. 처음 본 이름은 0에서 시작해야 하니까 `get(x, 0) + 1`. 그리고 '이름 → 번호' 장부를 '번호 → 이름'으로 뒤집으려면 `items()`를 돌면서 키와 값을 바꿔 넣으면 돼.

```python run
cargo = ["salt", "rope", "salt", "tea", "salt", "rope"]
count = {}
for c in cargo:
    count[c] = count.get(c, 0) + 1
print(count)                  # 처음 나온 순서대로
number = {"salt": 1, "rope": 2, "tea": 3}
name_of = {}
for name, n in number.items():
    name_of[n] = name
print(name_of[2])             # rope
```

- 키로는 문자열·숫자·튜플처럼 바뀌지 않는 값만 쓸 수 있어. 리스트는 키가 될 수 없어.
- `count[c] += 1`만 쓰면 처음 본 `c`에서 `KeyError`가 나. 처음엔 키가 없으니까!

## 미니 연습

화물을 세는 장부야. 처음 본 화물도 셀 수 있게 `get`의 기본값을 채워서 `{'salt': 2, 'rope': 1}`이 출력되게 해 봐.
