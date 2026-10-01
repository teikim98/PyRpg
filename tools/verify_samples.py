"""design.md §8.3 샘플 문제 5개 검증: 모범답안은 전부 AC, 오답·비효율 답안은 기대한 테스트에서 실패해야 한다."""
import ast
import subprocess
import sys
import textwrap

TIME_LIMIT = 2.0

P = {}

P["P0101"] = dict(kind="stdin", tests=[
    ("1 2", "3"), ("0 0", "0"), ("7 0", "7"),
    ("999999999999999999 1", "1000000000000000000"),
    ("1000000000000000000 1000000000000000000", "2000000000000000000")],
    sols={
        "model": ("a, b = map(int, input().split())\nprint(a + b)\n", {}),
        "wrongA": ("a, b = input().split()\nprint(a + b)\n", {1: "WA", 2: "WA", 3: "WA", 4: "WA", 5: "WA"}),
        "wrongB": ("a, b = map(float, input().split())\nprint(a + b)\n", {1: "WA", 2: "WA", 3: "WA", 4: "WA", 5: "WA"}),
    })

P["P0102"] = dict(kind="stdin", tests=[
    ("7 2", "3 1"), ("0 5", "0 0"), ("5 7", "0 5"), ("10 10", "1 0"),
    ("1000000000000000000 3", "333333333333333333 1"),
    ("999999999999999999 2", "499999999999999999 1"),
    ("1000000000000000000 1000000000000000000", "1 0")],
    sols={
        "model": ("a, b = map(int, input().split())\nprint(a // b, a % b)\n", {}),
        "wrongA": ("a, b = map(int, input().split())\nprint(a / b, a % b)\n", {i: "WA" for i in range(1, 8)}),
        "wrongB": ("a, b = map(int, input().split())\nprint(int(a / b), a % b)\n", {5: "WA", 6: "WA"}),
    })

P["P0103"] = dict(kind="func", tests=[
    ("(10, 3)", "4"), ("(9, 3)", "3"), ("(1, 1)", "1"),
    ("(1, 1000000000000000000)", "1"),
    ("(1000000000000000000, 1)", "1000000000000000000"),
    ("(999999999999999999, 1)", "999999999999999999"),
    ("(1000000000000000000, 3)", "333333333333333334")],
    sols={
        "model": ("def solution(hp, atk):\n    return (hp + atk - 1) // atk\n", {}),
        "wrongA": ("def solution(hp, atk):\n    return hp // atk\n", {1: "WA", 4: "WA", 7: "WA"}),
        "wrongB": ("import math\ndef solution(hp, atk):\n    return math.ceil(hp / atk)\n", {6: "WA", 7: "WA"}),
    })

P["P0104"] = dict(kind="stdin", tests=[
    ("ab\n3", "ababab"), ("z\n1", "z"), ("python\n2", "pythonpython"),
    ("abcdefghij\n100", "abcdefghij" * 100)],
    sols={
        "model": ("import sys\ninput = sys.stdin.readline\ns = input().strip()\nn = int(input())\nprint(s * n)\n", {}),
        "wrongA": ("import sys\ninput = sys.stdin.readline\ns = input()\nn = int(input())\nprint(s * n)\n", {1: "WA", 3: "WA", 4: "WA"}),
        "wrongB": ("import sys\ninput = sys.stdin.readline\ns = input().strip()\nn = input()\nprint(s * n)\n", {i: "RE" for i in range(1, 5)}),
    })

P["P0105"] = dict(kind="stdin", tests=[
    ("1 10", "55"), ("5 5", "5"), ("3 7", "25"),
    ("1 1000000000000000000", "500000000000000000500000000000000000"),
    ("100000000000000000 1000000000000000000", "495000000000000000550000000000000000"),
    ("1000000000000000000 1000000000000000000", "1000000000000000000")],
    sols={
        "model": ("a, b = map(int, input().split())\nprint((a + b) * (b - a + 1) // 2)\n", {}),
        "wrongA": ("a, b = map(int, input().split())\nprint((a + b) * (b - a + 1) / 2)\n", {i: "WA" for i in range(1, 7)}),
        "wrongB": ("a, b = map(int, input().split())\nprint(int((a + b) * (b - a + 1) / 2))\n", {4: "WA", 5: "WA"}),
        "slow": ("a, b = map(int, input().split())\ntotal = 0\nfor x in range(a, b + 1):\n    total += x\nprint(total)\n", {4: "TLE", 5: "TLE"}),
    })

FUNC_HARNESS = textwrap.dedent("""
    import ast, sys
    src = open(sys.argv[1]).read()
    g = {"__name__": "__main__"}
    exec(compile(src, "<user>", "exec"), g)
    args = ast.literal_eval(sys.argv[2])
    print(repr(g["solution"](*args)))
""")


def norm(s):
    return "\n".join(line.rstrip() for line in s.rstrip("\n").split("\n"))


def run(kind, code, test, tmp):
    inp, exp = test
    with open(tmp, "w") as f:
        f.write(code)
    if kind == "stdin":
        cmd, stdin = [sys.executable, tmp], inp + "\n"
    else:
        cmd, stdin = [sys.executable, "-c", FUNC_HARNESS, tmp, inp], ""
    try:
        r = subprocess.run(cmd, input=stdin, capture_output=True, text=True, timeout=TIME_LIMIT)
    except subprocess.TimeoutExpired:
        return "TLE"
    if r.returncode != 0:
        return "RE"
    if kind == "stdin":
        return "AC" if norm(r.stdout) == norm(exp) else "WA"
    return "AC" if ast.literal_eval(r.stdout.strip()) == ast.literal_eval(exp) else "WA"


def main():
    import os, tempfile
    tmp = os.path.join(tempfile.mkdtemp(), "sol.py")
    ok = True
    for pid, p in P.items():
        for name, (code, expected_fail) in p["sols"].items():
            got = {}
            for i, t in enumerate(p["tests"], 1):
                v = run(p["kind"], code, t, tmp)
                if v != "AC":
                    got[i] = v
            good = got == expected_fail
            ok &= good
            print(f"{pid} {name:7s} {'OK ' if good else 'BAD'} fails={got}")
    print("ALL OK" if ok else "MISMATCH")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
