조건이 붙은 **리스트 컴프리헨션** 한 줄이면 끝이야: `[g for g in gems if g % 2 == 0]`.

- 읽는 순서: "gems의 각 g에 대해(`for g in gems`), g가 짝수이면(`if g % 2 == 0`), g를 담아라(맨 앞의 `g`)."
- 반복문으로 풀면 이렇게 돼. 컴프리헨션은 이 네 줄을 한 줄로 줄인 거야.

```python
answer = []
for g in gems:
    if g % 2 == 0:
        answer.append(g)
```

- Python의 `%`는 음수에도 0 또는 양수 나머지를 줘서 `-4 % 2`는 `0`, `-3 % 2`는 `1`이야. 그래서 음수 짝수도 `g % 2 == 0`으로 잘 골라져.
- JS의 `gems.filter(g => g % 2 === 0)`이 Python에서는 컴프리헨션이야. 리스트에는 `filter` 메서드가 없어서 `gems.filter`는 `AttributeError`.
- **돌고 있는 리스트에서 원소를 지우면 안 돼.** `for g in gems:` 도중에 `gems.remove(g)`를 하면 뒤의 원소들이 한 칸씩 당겨져서, 바로 다음 원소를 건너뛰어. 홀수가 연달아 있으면 하나가 살아남아. 새 리스트를 만드는 게 안전해.
