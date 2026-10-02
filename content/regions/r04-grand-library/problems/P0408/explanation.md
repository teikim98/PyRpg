알파벳 26개마다 칸이 하나씩 있는 리스트 `cnt = [0] * 26`을 만들고, 글자 `c`의 칸 번호를 `ord(c) - ord("a")`로 구해서 1씩 늘리면 돼.

- `ord("a")`는 97이라서 `ord(c) - ord("a")`는 `a` → 0, `b` → 1, …, `z` → 25야. 리스트의 칸 번호와 딱 맞아.
- `ord(c) - 96`처럼 하나 덜 빼면 `a`가 1번 칸에 들어가서 전부 한 칸씩 밀리고, `z`는 26번 칸이라 `IndexError`가 나.
- 출력은 `print(*cnt)`. `print(cnt)`는 `[0, 0, 1, ...]`처럼 리스트 모양 그대로 찍혀.
- `" ".join(cnt)`는 `TypeError: sequence item 0: expected str instance, int found`야. join은 문자열만 엮으니까 `" ".join(map(str, cnt))`로 바꿔야 해.
- `s.count("a")`를 26번 부르는 방법도 답은 맞아. 다만 낱말을 26번 훑으니까, 한 번만 훑는 `cnt` 방법이 길어질수록 유리해.
