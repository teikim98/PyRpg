두 가지를 한 번에 해야 해: 입력을 **끝까지** 읽기, 그리고 **깨진 줄에서 멈추지 않기**.

- `for line in sys.stdin:`은 입력을 한 줄씩 꺼내 주다가 입력이 끝나면 반복도 저절로 끝나. 줄 수를 몰라도 돼. JS로 치면 `readline`의 `'line'` 이벤트를 끝까지 받는 셈이야.
- `int("7a")`는 `ValueError`를 내. 그대로 두면 주문이 그 줄에서 멈추니까, `try:` 안에서 `int`로 바꾸고 `except ValueError:`에서 깨진 줄을 하나 세고 넘어가.
- JS의 `try { } catch (e) { }`는 모든 에러를 한 곳에서 받지만, Python은 `except ValueError:`처럼 **받을 예외의 이름**을 적어. 이름 없는 `except:`는 오타로 생긴 `NameError`까지 삼켜서, 진짜 버그가 '깨진 줄'로 둔갑해. 받을 예외만 이름으로 받자.
- `while True:`와 `input()`으로 읽는다면 입력 끝의 `EOFError`도 따로 받아서 `break`해야 해. `except ValueError:` 하나만 있으면 끝에서 `EOFError`로 멈춰.
- 핵심 한 줄: `try: total += int(weight)` / `except ValueError: broken += 1`.
