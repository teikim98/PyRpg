번호와 값을 함께 꺼내는 `enumerate`가 딱 맞는 문제야.

- `for i, d in enumerate(depths, 1):`: `(1, 첫 깊이)`, `(2, 둘째 깊이)`, …를 차례로 꺼내서 `i`, `d`에 나눠 담아(언패킹). 두 번째 인자 `1`이 시작 번호야. 빼면 0부터 세.
- JS의 `arr.entries()`나 `arr.forEach((d, i) => ...)`와 비슷하지만, 시작 번호를 바로 정할 수 있는 게 편해.
- `d >= limit`: 'limit **이상**'은 같은 깊이도 포함이야.
- 반복문이 다 끝난 뒤에 `if not answer: return [-1]`. 빈 리스트는 거짓으로 취급되니까 `not answer`가 '비어 있으면'이라는 뜻이 돼.
- `return answer`를 `for` 안에 들여쓰면 첫 돌만 보고 함수가 끝나. `return`의 들여쓰기 깊이를 꼭 확인하자.
- 리스트 컴프리헨션으로 `answer = [i for i, d in enumerate(depths, 1) if d >= limit]`처럼 한 줄로 써도 돼. 마지막에 `return answer or [-1]`처럼 쓸 수도 있어(`answer`가 비면 `[-1]`).
