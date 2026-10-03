`Counter`로 한 번에 세고, 가장 큰 개수를 구한 뒤 그 개수인 이름 중 사전순으로 가장 앞선 것을 고르면 돼.

- `from collections import Counter`를 맨 위에 꼭 적어. 빠뜨리면 `NameError: name 'Counter' is not defined`야.
- `count = Counter(cargo)`는 `{이름: 개수}` 장부야. `max(count.values())`가 가장 큰 개수.
- `[name for name, n in count.items() if n == top]`은 가장 많이 나온 이름들. 문자열끼리 `min`을 하면 사전순으로 가장 앞선 것을 줘.
- `count.most_common(1)`은 이름이 아니라 `[('salt', 3)]`처럼 **(이름, 개수) 튜플의 리스트**야. 이름만 꺼내려면 `[0][0]`.
- 그런데 `most_common`은 개수가 같으면 **먼저 센 것**을 앞에 둬. 사전순이 아니라서 동률에서 틀릴 수 있어. 동률 규칙이 있으면 직접 골라야 해.
