문자열 메서드는 원래 문자열을 바꾸지 않고 **새 문자열을 돌려줘**. 그래서 결과를 다시 담거나, 메서드를 이어서 불러야 해.

- `title.strip().lower().replace("_", " ")`처럼 이어 쓰면 왼쪽부터 차례로 적용돼. 각 단계의 결과(새 문자열)에 다음 메서드를 부르는 거야.
- `title.strip()`이라고만 쓰고 담지 않으면 결과가 버려지고 `title`은 그대로야. `title = title.strip()`처럼 다시 담아.
- `replace("_", "")`로 쓰면 밑줄이 **지워져서** 단어가 붙어 버려. 규칙은 공백 한 칸으로 바꾸기야.
- JS의 `trim()`, `toLowerCase()`, `replaceAll()`은 Python에서 `strip()`, `lower()`, `replace()`야. Python의 `replace`는 기본으로 **전부** 바꿔.
- 이미 깨끗한 제목(`"map"`)은 그대로 돌려주면 돼.
