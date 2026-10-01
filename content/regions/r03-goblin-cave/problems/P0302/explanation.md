한 줄에 적힌 수들은 `list(map(int, input().split()))`로 **정수 리스트**를 만든 뒤, 내장 함수 `sum`, `max`, `min`에 맡기면 끝이야.

- `input().split()`은 `['3', '10', '7', '2']`처럼 **문자열** 리스트야. 이대로 `sum`을 부르면 `0 + '3'`을 하려다 `TypeError`가 나.
- 문자열끼리의 `max`/`min`은 사전 순으로 비교해. 첫 글자부터 보니까 `'7'`이 `'10'`보다 커(‘7’ > ‘1’). 숫자로 비교하려면 먼저 `int`로 바꿔야 해.
- 더미 수가 따로 주어지지 않아도 괜찮아. `split()`이 몇 개든 잘라 주고, 개수가 필요하면 `len(coins)`로 구하면 돼.
- Python의 정수는 크기 제한이 없어서 10억짜리 100개를 더해도 정확해.

```js
const coins = line.split(" ").map(Number);
coins.reduce((a, b) => a + b, 0);  // Python: sum(coins)
Math.max(...coins);                // Python: max(coins)
```
