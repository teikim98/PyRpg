"""콘텐츠 자동 검증(design.md §12.1).

content/ 아래 데이터를 읽어서 아래를 확인한다. 하나라도 실패하면 종료 코드 1.
- 문제: 필수 파일, 테스트 수(공개 1+, 숨김 3+, 경계값 note), 큰 정수 규칙(literal_eval), 4300자리 제한,
  모범답안 전부 AC, 오답·비효율 답안은 expectFail에 적은 테스트만 정확히 그 판정으로 실패,
  오답마다 첫 실패 테스트에서 자기 진단 규칙이 처음으로 걸리는지, 참조 무결성(주문서·스프라이트)
- 변형 문제(plan.md §5.1): 필드·statement 파일, 공개 1+/숨김 3+, 변형 ID 중복, 테스트 형식·4300자리,
  원래 모범답안 전부 AC, wrong_*.py는 변형마다 하나 이상 실패, 보스 slow.py는 전부 AC(시간 결계 없음)
- 레슨: 주문서 ID, 빈칸 연습 정답 실행 결과, ```python run 블록이 에러 없이 실행되는지
- 대사: region1-spec.md §5, region02-spec.md §5의 ID, 대사 줄 형식
- 지역: recommended 필드(번호·제목·사이트·레벨만), map.tmj가 있으면 맵 오브젝트 참조
- 보조 캐릭터: profile.json, traceback.json(실제 CPython 에러 메시지로 규칙 매칭 확인)

채점 규칙은 게임(src/python)과 같다.
- stdin형: 각 줄 끝 공백과 마지막 개행들을 무시하고 비교
- 함수형: 테스트마다 새 프로세스·새 globals에서 entry(*literal_eval(args)) == literal_eval(expect)

사용법: python3 tools/verify_content.py [-v] [-j N]
"""
import argparse
import ast
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
MANIFEST = os.path.join(ROOT, "assets", "manifest.json")

VERDICTS = {"AC", "WA", "RE", "TLE"}
EMOTIONS = {"neutral", "happy", "worried", "surprised", "serious"}
WHEN_KEYS = {"outputMatches", "exception", "messageMatches", "verdict", "onlyHiddenFail"}
RECOMMENDED_KEYS = {"site", "id", "title", "level"}
MAX_DIGITS = 4300

# docs/phase2/region1-spec.md §5. 레슨별 lesson_<ID>_intro/_done은 레슨 목록에서 만든다
REQUIRED_REGION_DIALOGUES = {
    "r01": [
        "prologue", "sign_well", "gate_well_locked", "sign_plaza", "npc_frozen_merchant",
        "npc_shopkeeper", "chest_shop", "sign_alley_riddle", "npc_echo_child", "chest_hidden",
        "boss_intro", "boss_defeated", "east_gate_locked", "to_be_continued", "region_clear",
    ],
    # docs/phase3/region02-spec.md §5
    "r02": [
        "region_intro", "forest_intro", "sign_forest", "sign_loop", "npc_lost_traveler", "npc_woodcutter",
        "chest_loop", "chest_hidden_grove", "boss_intro", "boss_defeated", "east_gate_locked", "to_be_continued",
        "region_clear",
    ],
}
REQUIRED_COMMON_DIALOGUES = [
    "need_scroll", "campfire_rest", "knockout", "solution_unlocked", "retreat",
    "practice_suggest", "shadow_registered", "level_up", "fatal_recursion",
]
# region1-spec.md §2, §3
REQUIRED_REGION_CONTENT = {
    "r01": {
        "lessons": {"L1-1": "scroll.voice", "L1-2": "scroll.convert", "L1-3": "scroll.arith", "L1-4": "scroll.quick_ear"},
        "problems": ["P0101", "P0102", "P0103", "P0104", "P0105", "P0106", "P0107", "P0108", "P0109", "P0110"],
        "boss": "P0105",
    },
    # region02-spec.md §2, §3
    "r02": {
        "lessons": {"L2-1": "scroll.branch", "L2-2": "scroll.loop", "L2-3": "scroll.while", "L2-4": "scroll.gather"},
        "problems": ["P0201", "P0202", "P0203", "P0204", "P0205", "P0206", "P0207", "P0208", "P0209", "P0210"],
        "boss": "P0210",
    },
}
# 명세의 아트 표(region02-spec.md §6 등)에 있어서 아트 담당이 만들 스프라이트.
# 아직 assets/manifest.json에 없으면 오류 대신 경고로 둔다(콘텐츠와 아트를 따로 작업하므로)
PENDING_SPRITES = {
    "r02": {
        "monster_fork_sprout", "monster_leap_owl", "monster_loop_snake", "monster_count_shroom",
        "monster_hail_wisp", "monster_acorn_mite", "boss_crossroad_tree", "npc_traveler", "npc_woodcutter",
    },
}
# 맵 오브젝트 종류별 필수 props(src/contracts/world.ts)
COMPARE_KEYS = {"sequenceAsList"}
MAP_OBJECT_TYPES = {"npc", "sign", "chest", "door", "monster", "campfire", "rune", "trigger", "warp", "spawn",
                    "board", "shop"}  # 단위 3-1 마을 시설(docs/phase3/plan.md §5.2)

# Traceback 해설 확인용: (코드, 예외 이름, 특정 패턴 규칙이 걸려야 하는지)
TRACEBACK_SAMPLES = [
    ('"a" + 1', "TypeError", True),
    ('1 + "a"', "TypeError", True),
    ('"ab" * "3"', "TypeError", True),
    ('"abc" - "a"', "TypeError", True),
    ("len(123)", "TypeError", True),
    ("3()", "TypeError", True),
    ("None + 1", "TypeError", True),
    ("a, b = 1", "TypeError", False),
    ('int("1.5")', "ValueError", True),
    ('int("1 2")', "ValueError", True),
    ("str(10 ** 5000)", "ValueError", True),
    ('int("9" * 5000)', "ValueError", True),
    ('float("abc")', "ValueError", True),
    ("a, b = [1]", "ValueError", True),
    ("a, b = [1, 2, 3]", "ValueError", True),
    ("[][0]", "IndexError", False),
    ('""[0]', "IndexError", True),
    ("1 // 0", "ZeroDivisionError", False),
    ("1 / 0", "ZeroDivisionError", False),
    ("1 % 0", "ZeroDivisionError", False),
    ('"7" % 2', "TypeError", True),
    ("if 1 = 1:\n    pass", "SyntaxError", True),
    ("prnt(1)", "NameError", False),
    ("x = true", "NameError", True),
    ("x = null", "NameError", True),
    ("console.log(1)", "NameError", True),
    ("(1).strip()", "AttributeError", True),
    ("[].push(1)", "AttributeError", True),
    ('"a".length', "AttributeError", True),
    ('"a".toUpperCase()', "AttributeError", True),
    ("input()", "EOFError", False),
    ("def f():\n    return f()\nf()", "RecursionError", False),
    ("let x = 1", "SyntaxError", False),
    ("x++", "SyntaxError", False),
    ("if 1 > 0\n    pass", "SyntaxError", True),
    ('print("a)', "SyntaxError", True),
    ("print((1)", "SyntaxError", True),
    ("print(1 2)", "SyntaxError", True),
    ("def f():\nreturn 1", "IndentationError", True),
    ("  x = 1", "IndentationError", True),
    ("if 1:\n    x = 1\n  y = 2", "IndentationError", False),
]
REQUIRED_TRACEBACK_EXCEPTIONS = [
    "NameError", "TypeError", "ValueError", "IndexError", "ZeroDivisionError", "SyntaxError",
    "IndentationError", "EOFError", "AttributeError", "RecursionError", "KeyboardInterrupt",
]

# 사용자 코드를 새 globals에서 실행하고, 결과(예외 이름·메시지, 함수형은 비교 결과)를 파일로 남긴다
HARNESS = r'''
import ast, json, sys
mode, path, result_path = sys.argv[1], sys.argv[2], sys.argv[3]
res = {"ok": True}
try:
    src = open(path, encoding="utf-8").read()
    # 함수형은 게임 채점기(judge.py FUNCTION_MODULE_NAME)처럼 __main__이 아닌 이름으로 실행한다
    g = {"__name__": "solution_module" if mode == "function" else "__main__", "__builtins__": __builtins__}
    exec(compile(src, "<user>", "exec"), g)
    if mode == "function":
        entry, args, expect = sys.argv[4], sys.argv[5], sys.argv[6]
        compare = json.loads(sys.argv[7]) if len(sys.argv) > 7 and sys.argv[7] else {}
        ret = g[entry](*ast.literal_eval(args))
        sys.stdout.flush()
        def seq(v):
            # judge.py sequences_as_lists와 같은 규칙
            return [seq(x) for x in v] if isinstance(v, (list, tuple)) else v
        want = ast.literal_eval(expect)
        equal = seq(ret) == seq(want) if compare.get("sequenceAsList") else ret == want
        res = {"ok": True, "repr": repr(ret), "equal": bool(equal)}
except SystemExit as e:
    if e.code not in (None, 0):
        res = {"ok": False, "type": "SystemExit", "message": str(e.code)}
except BaseException as e:
    # 메시지는 게임 채점기(src/python/judge.py _error_info)와 같게: SyntaxError는 e.msg, 나머지는 str(e)
    msg = (e.msg or "") if isinstance(e, SyntaxError) else str(e)
    res = {"ok": False, "type": type(e).__name__, "message": msg}
sys.stdout.flush()
with open(result_path, "w", encoding="utf-8") as f:
    json.dump(res, f)
'''


class Report:
    def __init__(self, verbose):
        self.errors = []
        self.warnings = []
        self.verbose = verbose

    def error(self, where, msg):
        self.errors.append(f"{where}: {msg}")
        print(f"  ERROR {where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")
        print(f"  WARN  {where}: {msg}")

    def info(self, msg):
        if self.verbose:
            print(f"  {msg}")


LINE_END_SPACE = " \t\r\f\v"


def norm(s):
    """게임 채점기(src/python/judge.py normalize_output, src/python/compare.ts)와 같은 출력 정규화(§5.5):
    \r\n → \n, 각 줄 끝의 ASCII 공백 제거, 끝의 빈 줄 제거. (공백만 있는 마지막 줄도 빈 줄로 본다)"""
    lines = [line.rstrip(LINE_END_SPACE) for line in s.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


# JS의 \s(플래그 없음)가 맞는 문자(ECMAScript WhiteSpace + LineTerminator). Python의 \s와 범위가 다르다
JS_SPACE = r"\t\n\x0b\x0c\r \xa0  -     　﻿"


def js_regex(pattern):
    """JS 정규식(플래그 없음, new RegExp(pattern).test)과 같게 동작하도록 고친 Python 정규식.

    게임(src/python/diagnose.ts, explain.ts)은 브라우저의 JS 정규식으로 규칙을 맞춰 보므로 검증도 같은 뜻이어야 한다.
    - $: JS는 문자열 맨 끝에서만 맞는다(Python의 $는 마지막 개행 앞에서도 맞는다) → \\Z
    - .: JS는 \\n, \\r, \\u2028, \\u2029를 넘지 않는다(Python은 \\n만)
    - \\s, \\S: JS의 공백 집합으로 바꾼다(Python은 \\x1c~\\x1f도 공백으로 본다)
    - \\d, \\w, \\b: JS는 ASCII만 본다 → re.ASCII(한글은 \\w가 아니다)
    """
    out, i, in_class = [], 0, False
    while i < len(pattern):
        c = pattern[i]
        if c == "\\" and i + 1 < len(pattern):
            e = pattern[i + 1]
            if e == "s":
                out.append(JS_SPACE if in_class else f"[{JS_SPACE}]")
            elif e == "S" and not in_class:
                out.append(f"[^{JS_SPACE}]")
            else:
                out.append(pattern[i:i + 2])
            i += 2
            continue
        if in_class:
            if c == "]":
                in_class = False
            out.append(c)
        elif c == "[":
            in_class = True
            out.append(c)
            # [^ 다음의 ]는 Python에서 글자 ]로 읽힌다. JS와 뜻이 다른 []·[^]는 check_regex가 막는다
            if pattern.startswith("^", i + 1):
                out.append("^")
                i += 1
        elif c == "$":
            out.append(r"\Z")
        elif c == ".":
            out.append(r"[^\n\r  ]")
        else:
            out.append(c)
        i += 1
    return re.compile("".join(out), re.ASCII)


def check_regex(rep, where, pattern):
    """Python과 JS 양쪽에서 같은 뜻인 정규식만 허용한다."""
    for bad in ("(?P", "(?<", "\\A", "\\Z", "(?i", "(?s", "(?m", "(?x", "(?a", "(?u", "(?L", "[]", "[^]", "\\u{"):
        if bad in pattern:
            rep.error(where, f"JS와 호환되지 않는 정규식 문법 {bad!r}: {pattern}")
            return None
    try:
        return js_regex(pattern)
    except re.error as e:
        rep.error(where, f"정규식 오류 {e}: {pattern}")
        return None


def load_json(rep, path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        rep.error(os.path.relpath(path, CONTENT), "파일 없음")
    except json.JSONDecodeError as e:
        rep.error(os.path.relpath(path, CONTENT), f"JSON 오류 {e}")
    return None


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


class Runner:
    def __init__(self, python):
        self.python = python
        self.tmp = tempfile.mkdtemp(prefix="verify_content_")
        self.count = 0

    def run(self, code_path, kind, stdin="", entry=None, args=None, expect=None, timeout=2.0, compare=None):
        """한 번 실행. 반환: dict(verdict, stdout, actual, error_type, error_message, timed_out)"""
        self.count += 1
        fd, result_path = tempfile.mkstemp(suffix=".json", dir=self.tmp)
        os.close(fd)
        cmd = [self.python, "-c", HARNESS, kind, code_path, result_path]
        if kind == "function":
            cmd += [entry, args, expect, json.dumps(compare) if compare else ""]
        try:
            proc = subprocess.run(cmd, input=stdin, capture_output=True, text=True, encoding="utf-8",
                                  timeout=timeout)
        except subprocess.TimeoutExpired:
            return {"verdict": "TLE", "stdout": "", "actual": "", "error_type": "KeyboardInterrupt",
                    "error_message": "", "stderr": ""}
        res = None
        try:
            with open(result_path, encoding="utf-8") as f:
                res = json.load(f)
            os.remove(result_path)
        except (OSError, json.JSONDecodeError):
            pass
        out = {"stdout": proc.stdout, "stderr": proc.stderr, "error_type": None, "error_message": None}
        if res is None:
            out.update(verdict="RE", actual=proc.stdout, error_type="Fatal", error_message=proc.stderr[-500:])
        elif not res["ok"]:
            out.update(verdict="RE", actual=proc.stdout, error_type=res["type"], error_message=res["message"])
        elif kind == "function":
            out.update(verdict="AC" if res["equal"] else "WA", actual=res["repr"])
        elif expect is None:
            out.update(verdict="AC", actual=proc.stdout)
        else:
            out.update(verdict="AC" if norm(proc.stdout) == norm(expect) else "WA", actual=proc.stdout)
        return out


# ---------------------------------------------------------------- 문제

def inline_code_lines(md):
    """펜스 밖에서 줄 전체가 인라인 코드 하나(`...`)인 줄 수. 이런 줄이 이어지면 한 문단(한 줄)으로 그려진다"""
    count, fence = 0, False
    for line in md.split("\n"):
        t = line.strip()
        if t.startswith("```") or t.startswith("~~~"):
            fence = not fence
            continue
        if not fence and re.fullmatch(r"`[^`]+`", t):
            count += 1
    return count


def test_label(i):
    return f"#{i + 1}"


def check_problem(rep, runner, pool, region_id, folder, scrolls, sprites, region_order):
    pid = os.path.basename(folder)
    where = f"{region_id}/{pid}"
    p = load_json(rep, os.path.join(folder, "problem.json"))
    if p is None:
        return None
    files = set(os.listdir(folder))
    for f in ("problem.json", "statement.md", "solution.py", "starter.py", "explanation.md"):
        if f not in files:
            rep.error(where, f"필수 파일 없음: {f}")
    if p.get("id") != pid:
        rep.error(where, f"id {p.get('id')!r}가 폴더 이름과 다름")
    if not re.fullmatch(rf"P{region_order:02d}\d\d", pid):
        rep.error(where, f"문제 ID 형식이 P{region_order:02d}NN이 아님")
    for key, typ in (("title", str), ("kind", str), ("enemy", dict), ("requires", list), ("concept", str),
                     ("boss", bool), ("timeLimitMs", int), ("estimatedMinutes", int), ("tests", list),
                     ("wrong", list), ("hints", list), ("reward", dict)):
        if not isinstance(p.get(key), typ):
            rep.error(where, f"{key} 필드가 없거나 형식이 {typ.__name__}이 아님")
            return None
    kind = p["kind"]
    if kind not in ("stdin", "function"):
        rep.error(where, f"kind {kind!r}")
        return None
    entry = p.get("entry", "solution")
    compare = p.get("compare")
    if compare is not None:
        if kind != "function" or not isinstance(compare, dict) or set(compare) - COMPARE_KEYS or \
                not all(isinstance(v, bool) for v in compare.values()):
            rep.error(where, f"compare는 함수형에만, {sorted(COMPARE_KEYS)} 불리언 옵션: {compare!r}")
            compare = None
    enemy = p["enemy"]
    if not isinstance(enemy.get("name"), str) or not isinstance(enemy.get("attack"), int) or enemy["attack"] <= 0:
        rep.error(where, "enemy.name/attack 형식 오류")
    if enemy.get("sprite") not in sprites:
        if enemy.get("sprite") in PENDING_SPRITES.get(region_id, set()):
            rep.warn(where, f"enemy.sprite {enemy.get('sprite')!r}가 아직 assets/manifest.json에 없음(명세의 아트 목록)")
        else:
            rep.error(where, f"enemy.sprite {enemy.get('sprite')!r}가 assets/manifest.json에 없음")
    for s in p["requires"]:
        if s not in scrolls:
            rep.error(where, f"requires의 주문서 {s!r}가 레슨에 없음")
    if p["concept"] not in scrolls:
        rep.error(where, f"concept {p['concept']!r}가 주문서 ID가 아님")
    if len(p["hints"]) != 3 or not all(isinstance(h, str) and h.strip() for h in p["hints"]):
        rep.error(where, "hints는 비어 있지 않은 문자열 3개여야 함")
    for i, h in enumerate(p["hints"]):
        if isinstance(h, str) and inline_code_lines(h) >= 2:
            rep.error(where, f"힌트 {i + 1}: 코드 줄마다 `...`로 감싸면 Markdown 문단으로 합쳐져 한 줄로 보임. "
                             "여러 줄 코드는 ```python 펜스 블록으로 쓸 것")
    want_reward = {"xp": 1000, "gold": 500} if p["boss"] else {"xp": 100, "gold": 50}
    if p["reward"] != want_reward:
        rep.error(where, f"reward {p['reward']} != {want_reward}(design.md §7.1~7.2)")
    if p["timeLimitMs"] <= 0 or p["estimatedMinutes"] <= 0:
        rep.error(where, "timeLimitMs/estimatedMinutes는 양수")

    # 테스트
    tests = p["tests"]
    publics = [t for t in tests if t.get("public")]
    hiddens = [t for t in tests if not t.get("public")]
    if len(publics) < 1 or len(hiddens) < 3:
        rep.error(where, f"공개 {len(publics)}개, 숨김 {len(hiddens)}개(공개 1+, 숨김 3+ 필요)")
    if not any("경계" in (t.get("note") or "") for t in tests):
        rep.error(where, "경계값 테스트(note에 '경계')가 없음")
    phases = sorted({t.get("phase", 1) for t in tests})

    def check_test_format(tw, t):
        """테스트 하나의 형식(stdin형 in/out, 함수형 args/expect 리터럴, 4300자리 제한). 실행할 수 있으면 True"""
        if not isinstance(t, dict):
            rep.error(tw, "테스트는 객체")
            return False
        if kind == "stdin":
            if not isinstance(t.get("in"), str) or not isinstance(t.get("out"), str):
                rep.error(tw, "stdin형 테스트는 in/out 문자열")
                return False
            if not t["in"].endswith("\n"):
                rep.error(tw, "in은 개행으로 끝나야 함")
            texts = [t["in"], t["out"]]
        else:
            if not isinstance(t.get("args"), str) or not isinstance(t.get("expect"), str):
                rep.error(tw, "함수형 테스트는 args/expect를 Python 리터럴 문자열로")
                return False
            try:
                if not isinstance(ast.literal_eval(t["args"]), tuple):
                    rep.error(tw, f"args {t['args']!r}가 튜플이 아님(인자 하나면 '(x,)')")
            except (ValueError, SyntaxError):
                rep.error(tw, f"args {t['args']!r}를 literal_eval로 읽을 수 없음")
                return False
            try:
                ast.literal_eval(t["expect"])
            except (ValueError, SyntaxError):
                rep.error(tw, f"expect {t['expect']!r}를 literal_eval로 읽을 수 없음")
                return False
            texts = [t["args"], t["expect"]]
        for s in texts:
            m = max((len(x) for x in re.findall(r"\d+", s)), default=0)
            if m > MAX_DIGITS:
                rep.error(tw, f"{m}자리 정수(4300자리 제한, design.md §9.4)")
        return True

    for i, t in enumerate(tests):
        tw = f"{where} 테스트 {test_label(i)}"
        if not check_test_format(tw, t):
            continue
        if not p["boss"] and t.get("phase", 1) != 1:
            rep.error(tw, "보스가 아닌 문제에 phase")
    if p["boss"]:
        ph = p.get("phases")
        if not isinstance(ph, list) or [x.get("phase") for x in ph] != phases or len(phases) < 2:
            rep.error(where, f"보스 phases가 테스트 페이즈 {phases}와 맞지 않음")
        if "slow.py" not in files:
            rep.error(where, "보스에 slow.py(비효율 답안)가 없음")
    elif p.get("phases"):
        rep.error(where, "보스가 아닌 문제에 phases")

    # 진단 규칙: 로더와 같은 순서(extraDiagnoses → wrong[] 순서)
    diagnoses = []
    for d in p.get("extraDiagnoses", []):
        diagnoses.append(("extra", d))
    for w in p["wrong"]:
        if "diagnosis" not in w:
            rep.error(where, f"{w.get('file')}에 diagnosis 없음")
            continue
        diagnoses.append((w["file"], w["diagnosis"]))
    compiled = []
    for owner, d in diagnoses:
        dw = f"{where} 진단({owner})"
        when = d.get("when") if isinstance(d, dict) else None
        if not isinstance(when, dict) or not when or set(when) - WHEN_KEYS or not isinstance(d.get("text"), str):
            rep.error(dw, f"진단 형식 오류: {d}")
            compiled.append((owner, None))
            continue
        if "verdict" in when and when["verdict"] not in VERDICTS:
            rep.error(dw, f"verdict {when['verdict']!r}")
        rx = {}
        for k in ("outputMatches", "messageMatches"):
            if k in when:
                rx[k] = check_regex(rep, dw, when[k])
        compiled.append((owner, (when, rx)))

    # 실행: 모범답안, 오답, 비효율 답안, 시작 코드
    limit = p["timeLimitMs"] / 1000
    wrong_files = [w.get("file") for w in p["wrong"]]
    if not any(f and f.startswith("wrong_") for f in wrong_files):
        rep.error(where, "오답 예시(wrong_*.py)가 하나도 없음")
    for f in sorted(files):
        if (f.startswith("wrong_") or f == "slow.py") and f not in wrong_files:
            rep.error(where, f"{f}가 problem.json의 wrong[]에 없음")
    accepted = p.get("accepted", [])
    if not isinstance(accepted, list) or not all(isinstance(a, dict) and isinstance(a.get("file"), str) for a in accepted):
        rep.error(where, "accepted는 {file, title} 배열")
        accepted = []
    accepted_files = [a["file"] for a in accepted]
    for f in sorted(files):
        if f.startswith("alt_") and f not in accepted_files:
            rep.error(where, f"{f}가 problem.json의 accepted[]에 없음")

    def judge(code_file, test_list=None):
        path = os.path.join(folder, code_file)
        jobs = []
        for t in tests if test_list is None else test_list:
            if kind == "stdin":
                jobs.append(pool.submit(runner.run, path, "stdin", stdin=t["in"], expect=t["out"], timeout=limit))
            else:
                jobs.append(pool.submit(runner.run, path, "function", entry=entry, args=t["args"],
                                        expect=t["expect"], timeout=limit, compare=compare))
        return [j.result() for j in jobs]

    def diagnose(results):
        """design.md §5.3 오답 진단. src/python/diagnose.ts와 같은 의미:
        첫 실패 테스트에 대해 규칙을 배열 순서대로 보고 처음 맞는 것. when의 조건은 모두 맞아야 한다.
        outputMatches는 가공하지 않은 actual(stdout 그대로, 함수형은 repr)에 JS 정규식 의미(js_regex)로 적용한다."""
        fails = [i for i, r in enumerate(results) if r["verdict"] != "AC"]
        if not fails:
            return None
        first = results[fails[0]]
        # 공개 테스트를 모두 통과했고 첫 실패가 숨김 테스트
        only_hidden = not tests[fails[0]].get("public") and \
            all(results[i]["verdict"] == "AC" for i, t in enumerate(tests) if t.get("public"))
        for idx, (owner, c) in enumerate(compiled):
            if c is None:
                continue
            when, rx = c
            if "verdict" in when and when["verdict"] != first["verdict"]:
                continue
            if "exception" in when and when["exception"] != first["error_type"]:
                continue
            if "onlyHiddenFail" in when and when["onlyHiddenFail"] != only_hidden:
                continue
            if "outputMatches" in when and (rx.get("outputMatches") is None or
                                            not rx["outputMatches"].search(first["actual"] or "")):
                continue
            if "messageMatches" in when and (rx.get("messageMatches") is None or
                                             not rx["messageMatches"].search(first["error_message"] or "")):
                continue
            return idx, owner
        return None

    if "solution.py" in files:
        res = judge("solution.py")
        bad = {i + 1: r["verdict"] for i, r in enumerate(res) if r["verdict"] != "AC"}
        if bad:
            rep.error(where, f"모범답안이 실패: {bad} {[(r['error_type'], r['error_message']) for r in res if r['verdict'] == 'RE'][:1]}")
        else:
            rep.info(f"{where} solution.py  OK  {len(res)}/{len(res)} AC")

    # 정답으로 인정하는 다른 답안(예: 튜플 반환): 전부 AC여야 한다
    for f in accepted_files:
        if f not in files:
            rep.error(f"{where} {f}", "파일 없음")
            continue
        res = judge(f)
        bad = {i + 1: r["verdict"] for i, r in enumerate(res) if r["verdict"] != "AC"}
        if bad:
            rep.error(f"{where} {f}", f"정답으로 인정해야 하는 답안이 실패: {bad}")
        else:
            rep.info(f"{where} {f}  OK  {len(res)}/{len(res)} AC")

    test_phase = {i + 1: t.get("phase", 1) for i, t in enumerate(tests)}
    for w in p["wrong"]:
        f = w.get("file")
        ww = f"{where} {f}"
        if not f or f not in files:
            rep.error(ww, "파일 없음")
            continue
        exp = w.get("expectFail")
        if not isinstance(exp, dict) or not exp:
            rep.error(ww, "expectFail은 {테스트 번호: 판정} 객체")
            continue
        try:
            exp = {int(k): v for k, v in exp.items()}
        except ValueError:
            rep.error(ww, "expectFail 키는 테스트 번호(1부터)")
            continue
        for k, v in exp.items():
            if v not in VERDICTS - {"AC"} or not 1 <= k <= len(tests):
                rep.error(ww, f"expectFail {k}: {v} 형식 오류")
        is_slow = f == "slow.py" or w.get("slow")
        if is_slow:
            if not p["boss"]:
                rep.error(ww, "비효율 답안은 보스 문제에만")
            if any(test_phase[k] < 2 for k in exp) or not any(v == "TLE" for v in exp.values()):
                rep.error(ww, "비효율 답안은 시간 결계(2페이즈 이상) 테스트에서만 TLE로 실패해야 함")
        res = judge(f)
        got = {i + 1: r["verdict"] for i, r in enumerate(res) if r["verdict"] != "AC"}
        if got != exp:
            rep.error(ww, f"판정 불일치: 기대 {exp}, 실제 {got}")
        else:
            rep.info(f"{ww:<22} OK  fails={got}")
        d = diagnose(res)
        if d is None or d[1] != f:
            rep.error(ww, f"첫 실패 테스트에서 처음 걸리는 진단이 자기 규칙이 아님(걸린 규칙: {d})")

    check_variants(rep, p, where, folder, files, judge, check_test_format, accepted_files)

    # 시작 코드: 문법이 맞고, 함수형이면 entry가 있어야 한다
    if "starter.py" in files:
        src = read_text(os.path.join(folder, "starter.py"))
        try:
            tree = compile(src, "starter.py", "exec", ast.PyCF_ONLY_AST)
            if kind == "function" and not any(isinstance(n, ast.FunctionDef) and n.name == entry for n in tree.body):
                rep.error(where, f"starter.py에 def {entry}(...)가 없음")
        except SyntaxError as e:
            rep.error(where, f"starter.py 문법 오류 {e}")
        if kind == "function":
            d = diagnose(judge("starter.py"))
            rep.info(f"{where} starter.py 진단 → {d}")

    # 재귀 깊이(design.md §9.5): C 코드를 거치는 재귀는 브라우저에서 fatal이 날 수 있다
    if "solution.py" in files and "lru_cache" in read_text(os.path.join(folder, "solution.py")):
        rep.warn(where, "모범답안이 lru_cache를 씀. 재귀 깊이 300 이하인지 확인(§9.5)")
    return p


VARIANT_KEYS = {"id", "title", "statement", "tests"}
VARIANT_TEST_KEYS = {"in", "out", "args", "expect", "public", "note"}
VARIANT_IDS = {}  # 변형 ID → 문제 위치(전체에서 겹치면 안 됨)


def check_variants(rep, p, where, folder, files, judge, check_test_format, accepted_files):
    """그림자 몬스터용 변형 문제(docs/phase3/plan.md §5.1, design.md §7.6).
    같은 개념·같은 입출력 형식이라 원래 모범답안이 모든 변형 테스트를 통과해야 하고,
    wrong_*.py 오답은 변형마다 하나 이상의 테스트에서 실패해야 한다(답 외우기 방지)."""
    pid = p["id"]
    variants = p.get("variants")
    if variants is None:
        rep.warn(where, "variants(그림자 몬스터용 변형 문제)가 없음")
        return
    if not isinstance(variants, list) or len(variants) < 2:
        rep.error(where, "variants는 변형 2개 이상의 배열(plan.md §5.1)")
        return
    wrong_files = [w.get("file") for w in p["wrong"] if (w.get("file") or "").startswith("wrong_") and w["file"] in files]
    for n, v in enumerate(variants, 1):
        vw = f"{where} 변형 {n}"
        if not isinstance(v, dict):
            rep.error(vw, "변형은 객체")
            continue
        if set(v) - VARIANT_KEYS:
            rep.error(vw, f"모르는 필드 {sorted(set(v) - VARIANT_KEYS)}(허용: {sorted(VARIANT_KEYS)})")
        vid = v.get("id")
        if not isinstance(vid, str) or not re.fullmatch(rf"{pid}-v\d+", vid):
            rep.error(vw, f"id {vid!r}가 {pid}-vN 형식이 아님")
        else:
            vw = f"{where} {vid}"
            if vid in VARIANT_IDS:
                rep.error(vw, f"변형 ID가 {VARIANT_IDS[vid]}와 겹침")
            VARIANT_IDS[vid] = where
        if not isinstance(v.get("title"), str) or not v["title"].strip():
            rep.error(vw, "title이 없음")
        st = v.get("statement")
        if not isinstance(st, str) or not st.endswith(".md") or os.path.isabs(st) or ".." in st.split("/"):
            rep.error(vw, f"statement {st!r}는 문제 폴더 안의 .md 상대 경로")
        elif not os.path.isfile(os.path.join(folder, st)):
            rep.error(vw, f"statement 파일 없음: {st}")
        elif not read_text(os.path.join(folder, st)).strip():
            rep.error(vw, f"statement 파일이 비어 있음: {st}")
        tests = v.get("tests")
        if not isinstance(tests, list):
            rep.error(vw, "tests 배열이 없음")
            continue
        publics = [t for t in tests if isinstance(t, dict) and t.get("public")]
        hiddens = [t for t in tests if isinstance(t, dict) and not t.get("public")]
        if len(publics) < 1 or len(hiddens) < 3:
            rep.error(vw, f"공개 {len(publics)}개, 숨김 {len(hiddens)}개(공개 1+, 숨김 3+ 필요)")
        if not any("경계" in (t.get("note") or "") for t in tests if isinstance(t, dict)):
            rep.error(vw, "경계값 테스트(note에 '경계')가 없음")
        ok = True
        for i, t in enumerate(tests):
            tw = f"{vw} 테스트 {test_label(i)}"
            if not check_test_format(tw, t):
                ok = False
                continue
            extra = set(t) - VARIANT_TEST_KEYS
            if extra:
                # phase 등: 그림자전에는 시간 결계가 없다
                rep.error(tw, f"변형 테스트에 쓸 수 없는 필드 {sorted(extra)}")
        if not ok:
            continue

        # 원래 모범답안(과 정답으로 인정하는 답안)은 전부 AC
        for f in ["solution.py"] + accepted_files:
            if f not in files:
                continue
            res = judge(f, tests)
            bad = {i + 1: r["verdict"] for i, r in enumerate(res) if r["verdict"] != "AC"}
            if bad:
                rep.error(f"{vw} {f}", f"원래 문제의 정답이 변형에서 실패: {bad} "
                                       f"{[(r['error_type'], r['error_message']) for r in res if r['verdict'] == 'RE'][:1]}")
            else:
                rep.info(f"{vw} {f}  OK  {len(res)}/{len(res)} AC")
        # 비효율 답안: 그림자전은 시간 결계가 없으니 1페이즈 크기 입력이라 통과해야 한다
        if "slow.py" in files:
            res = judge("slow.py", tests)
            bad = {i + 1: r["verdict"] for i, r in enumerate(res) if r["verdict"] != "AC"}
            if bad:
                rep.error(f"{vw} slow.py", f"비효율 답안이 실패: {bad}(변형은 1페이즈 크기 입력만)")
        # 오답은 변형마다 하나 이상의 테스트에서 실패
        for f in wrong_files:
            res = judge(f, tests)
            got = {i + 1: r["verdict"] for i, r in enumerate(res) if r["verdict"] != "AC"}
            if not got:
                rep.error(f"{vw} {f}", "오답이 변형의 모든 테스트를 통과함(오답을 잡는 테스트를 넣을 것)")
            else:
                rep.info(f"{vw} {f:<12} fails={got}")


# ---------------------------------------------------------------- 레슨

def run_block(runner, code, stdin=""):
    fd, path = tempfile.mkstemp(suffix=".py", dir=runner.tmp)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(code)
    return runner.run(path, "stdin", stdin=stdin, expect=None, timeout=5.0)


def check_lesson(rep, runner, region_id, folder):
    lid = os.path.basename(folder)
    where = f"{region_id}/{lid}"
    data = load_json(rep, os.path.join(folder, "lesson.json"))
    md_path = os.path.join(folder, "lesson.md")
    if data is None:
        return None
    if not os.path.exists(md_path):
        rep.error(where, "lesson.md 없음")
        return None
    if data.get("id") != lid:
        rep.error(where, f"id {data.get('id')!r}가 폴더 이름과 다름")
    sc = data.get("scroll")
    if not isinstance(sc, dict) or not all(isinstance(sc.get(k), str) and sc.get(k) for k in ("id", "name", "summary")):
        rep.error(where, "scroll에 id/name/summary 필요")
        return None
    if not sc["id"].startswith("scroll."):
        rep.error(where, f"주문서 ID {sc['id']!r}가 scroll.<이름> 형식이 아님")
    if not isinstance(data.get("title"), str):
        rep.error(where, "title 없음")
    body = read_text(md_path)
    run_blocks = re.findall(r"^```python run[ \t]*\n(.*?)^```[ \t]*$", body, re.S | re.M)
    if not run_blocks:
        rep.error(where, "```python run 블록이 없음")
    if not re.search(r"^```js compare[ \t]*$", body, re.M):
        rep.error(where, "```js compare 블록이 없음")
    for n, code in enumerate(run_blocks, 1):
        r = run_block(runner, code)
        if r["verdict"] != "AC":
            rep.error(where, f"run 블록 {n} 실행 실패: {r['verdict']} {r['error_type']}: {r['error_message']}")
        else:
            rep.info(f"{where} run 블록 {n} OK")
    ex = data.get("exercise")
    if ex is not None:
        if ex.get("kind") != "blank":
            rep.error(where, "exercise.kind는 'blank'")
        else:
            code = ex.get("code", "")
            for k in ("prompt", "code", "expectedOutput", "answer"):
                if not isinstance(ex.get(k), str):
                    rep.error(where, f"exercise.{k} 필요")
            if code.count("___") != 1:
                rep.error(where, "exercise.code에 빈칸 ___이 정확히 하나여야 함")
            else:
                r = run_block(runner, code.replace("___", ex.get("answer", "")), ex.get("stdin", ""))
                if r["verdict"] != "AC" or norm(r["stdout"]) != norm(ex.get("expectedOutput", "")):
                    rep.error(where, f"빈칸 연습 정답 실행 결과 불일치: {r['verdict']} {r['stdout']!r} "
                                     f"{r['error_type']}: {r['error_message']}")
                else:
                    rep.info(f"{where} 빈칸 연습 OK")
                # 빈칸을 그대로 두면 정답이 아니어야 한다
                r2 = run_block(runner, code.replace("___", "None"), ex.get("stdin", ""))
                if r2["verdict"] == "AC" and norm(r2["stdout"]) == norm(ex.get("expectedOutput", "")):
                    rep.error(where, "빈칸에 None을 넣어도 정답이 됨")
    return data


# ---------------------------------------------------------------- 대사

def check_dialogues(rep, where, d):
    if not isinstance(d, dict):
        rep.error(where, "대사 파일은 {ID: [줄...]} 객체")
        return {}
    for did, lines in d.items():
        if not re.fullmatch(r"[a-z0-9_]+|lesson_L\d+-\d+_(intro|done)", did):
            rep.error(where, f"대사 ID {did!r}가 소문자 스네이크가 아님")
        if not isinstance(lines, list) or not lines:
            rep.error(where, f"{did}: 줄 목록이 비어 있음")
            continue
        for n, line in enumerate(lines, 1):
            if not isinstance(line, dict) or not isinstance(line.get("speaker"), str) or \
                    not isinstance(line.get("text"), str) or not line["text"].strip():
                rep.error(where, f"{did} {n}번째 줄: speaker/text 필요")
                continue
            if set(line) - {"speaker", "emotion", "text"}:
                rep.error(where, f"{did} {n}번째 줄: 모르는 필드 {set(line) - {'speaker', 'emotion', 'text'}}")
            if "emotion" in line and line["emotion"] not in EMOTIONS:
                rep.error(where, f"{did} {n}번째 줄: emotion {line['emotion']!r}")
            if line["speaker"] == "companion" and "emotion" not in line:
                rep.warn(where, f"{did} {n}번째 줄: 보조 캐릭터 줄에 emotion 없음")
            for ph in re.findall(r"\{(\w+)\}", line["text"]):
                if ph not in ("player", "companion"):
                    rep.error(where, f"{did} {n}번째 줄: 모르는 치환자 {{{ph}}}")
    return d


# ---------------------------------------------------------------- 맵

def tiled_props(obj):
    props = {}
    for pr in obj.get("properties", []) or []:
        props[pr.get("name")] = pr.get("value")
    return props


def check_map(rep, region_id, map_path, problems, lessons, dialogues, scrolls, sprites):
    where = f"{region_id}/map.tmj"
    m = load_json(rep, map_path)
    if m is None:
        return
    objs = []
    for layer in m.get("layers", []):
        if layer.get("type") == "objectgroup":
            objs.extend(layer.get("objects", []))
    if not objs:
        rep.error(where, "오브젝트 레이어가 비어 있음")
        return
    ids = {}
    for o in objs:
        oid = o.get("name")
        otype = o.get("type") or o.get("class")
        props = tiled_props(o)
        ow = f"{where} {oid}"
        if not oid:
            rep.error(where, f"이름(ID) 없는 오브젝트 {o.get('id')}")
            continue
        if oid in ids:
            rep.error(ow, "오브젝트 ID 중복")
        ids[oid] = (otype, props)
        if otype not in MAP_OBJECT_TYPES:
            rep.error(ow, f"모르는 오브젝트 종류 {otype!r}")
        for key in ("dialogue", "lockedDialogue", "openDialogue"):
            if key in props and props[key] not in dialogues:
                rep.error(ow, f"{key}={props[key]!r} 대사가 없음")
        if "lesson" in props and props["lesson"] not in lessons:
            rep.error(ow, f"lesson={props['lesson']!r} 레슨이 없음")
        if "sprite" in props and props["sprite"] not in sprites:
            if props["sprite"] in PENDING_SPRITES.get(region_id, set()):
                rep.warn(ow, f"sprite={props['sprite']!r}가 아직 manifest에 없음(명세의 아트 목록)")
            else:
                rep.error(ow, f"sprite={props['sprite']!r}가 manifest에 없음")
        if otype == "monster":
            if props.get("problem") not in problems:
                rep.error(ow, f"problem={props.get('problem')!r} 문제가 없음")
        if otype == "rune" and "lesson" not in props:
            rep.error(ow, "rune에 lesson 없음")
        if otype in ("sign", "npc") and "dialogue" not in props:
            rep.error(ow, f"{otype}에 dialogue 없음")
        if "requires" in props:
            for cond in str(props["requires"]).split(","):
                cond = cond.strip()
                kind, _, val = cond.partition(":")
                ok = (kind == "lesson" and val in lessons) or (kind == "problem" and val in problems) or \
                     (kind == "scroll" and val in scrolls) or (kind == "flag" and bool(val))
                if not ok:
                    rep.error(ow, f"requires 조건 {cond!r}가 가리키는 대상이 없음")
    placed_problems = {p.get("problem") for t, p in ids.values() if t == "monster"}
    placed_lessons = {p.get("lesson") for t, p in ids.values() if t in ("rune", "npc", "trigger")}
    for pid in problems:
        if pid not in placed_problems:
            rep.error(where, f"문제 {pid}의 몬스터가 맵에 없음")
    for lid in lessons:
        if lid not in placed_lessons:
            rep.error(where, f"레슨 {lid}의 비석이 맵에 없음")
    if not any(t == "spawn" for t, _ in ids.values()):
        rep.error(where, "spawn 오브젝트가 없음")


def check_warps(rep, rdir):
    """지역 간 이동(docs/phase3/region02-spec.md §4): warp의 target 지역과 targetSpawn 오브젝트가 있는지.
    아직 만들지 않은 지역을 가리키면 경고(게임은 openDialogue만 보여 주고 머문다)."""
    regions = {}
    warps = []
    for name in sorted(os.listdir(rdir)):
        folder = os.path.join(rdir, name)
        try:
            with open(os.path.join(folder, "region.json"), encoding="utf-8") as f:
                rid = json.load(f).get("id")
            with open(os.path.join(folder, "map.tmj"), encoding="utf-8") as f:
                m = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        objs = [o for layer in m.get("layers", []) if layer.get("type") == "objectgroup" for o in layer.get("objects", [])]
        regions[rid] = {o.get("name") for o in objs}
        for o in objs:
            if (o.get("type") or o.get("class")) == "warp":
                warps.append((rid, o.get("name"), tiled_props(o)))
    for rid, oid, props in warps:
        where = f"{rid}/map.tmj {oid}"
        target, spawn = props.get("target"), props.get("targetSpawn")
        if spawn is not None and target is None:
            rep.error(where, "targetSpawn만 있고 target이 없음")
        if target is None:
            continue
        if not isinstance(spawn, str) or not spawn:
            rep.error(where, "target이 있으면 targetSpawn도 필요")
        elif target not in regions:
            rep.warn(where, f"target={target!r} 지역이 아직 없음(openDialogue만 보여 주고 머묾)")
        elif spawn not in regions[target]:
            rep.error(where, f"targetSpawn={spawn!r}가 {target} 맵에 없음")


# ---------------------------------------------------------------- 보조 캐릭터

def check_companion(rep, runner, portraits):
    prof = load_json(rep, os.path.join(CONTENT, "companion", "profile.json"))
    if prof is not None:
        if not isinstance(prof.get("name"), str) or not isinstance(prof.get("portrait"), str):
            rep.error("companion/profile.json", "name/portrait 필요")
        else:
            for e in EMOTIONS:
                if f"{prof['portrait']}_{e}" not in portraits:
                    rep.error("companion/profile.json", f"초상화 {prof['portrait']}_{e}가 manifest에 없음")
    rules = load_json(rep, os.path.join(CONTENT, "companion", "traceback.json"))
    if not isinstance(rules, list):
        rep.error("companion/traceback.json", "규칙 배열이어야 함")
        return
    where = "companion/traceback.json"
    compiled = []
    default_at = {}
    for i, r in enumerate(rules):
        if not isinstance(r, dict) or not isinstance(r.get("exception"), str) or not isinstance(r.get("text"), str):
            rep.error(where, f"{i}번째 규칙 형식 오류")
            compiled.append(None)
            continue
        if set(r) - {"exception", "pattern", "text"}:
            rep.error(where, f"{i}번째 규칙: 모르는 필드")
        if "pattern" in r:
            if r["exception"] in default_at:
                rep.error(where, f"{r['exception']} 기본 규칙 뒤에 패턴 규칙이 있음(순서상 걸리지 않음)")
            compiled.append((r["exception"], check_regex(rep, where, r["pattern"])))
        else:
            if r["exception"] in default_at:
                rep.error(where, f"{r['exception']} 기본 규칙이 두 개")
            default_at[r["exception"]] = i
            compiled.append((r["exception"], None))
    for exc in REQUIRED_TRACEBACK_EXCEPTIONS:
        if exc not in default_at:
            rep.error(where, f"{exc}의 기본 규칙(pattern 없음)이 없음")
    for code, exc, specific in TRACEBACK_SAMPLES:
        r = run_block(runner, code)
        if r["error_type"] != exc:
            rep.error(where, f"표본 {code!r}의 예외가 {r['error_type']}(기대 {exc})")
            continue
        hit = None
        for i, c in enumerate(compiled):
            if c is None or c[0] != exc:
                continue
            if c[1] is None or c[1].search(r["error_message"]):
                hit = i
                break
        if hit is None:
            rep.error(where, f"{exc}: {r['error_message']!r}에 맞는 규칙이 없음")
        elif specific and "pattern" not in rules[hit]:
            rep.error(where, f"{exc}: {r['error_message']!r}에 패턴 규칙이 걸려야 하는데 기본 규칙이 걸림")
        else:
            rep.info(f"traceback {code!r} → 규칙 {hit}")


# ---------------------------------------------------------------- 지역

def check_region(rep, runner, pool, folder, sprites, common_dialogues):
    data = load_json(rep, os.path.join(folder, "region.json"))
    if data is None:
        return
    rid = data.get("id", "?")
    name = os.path.basename(folder)
    print(f"[지역] {rid} {data.get('name')} ({name})")
    if not re.fullmatch(r"r\d\d", rid) or not name.startswith(rid + "-"):
        rep.error(name, f"지역 ID {rid!r}와 폴더 이름이 맞지 않음")
    order = data.get("order")
    if not isinstance(order, int) or f"r{order:02d}" != rid:
        rep.error(rid, f"order {order!r}가 ID와 맞지 않음")
        order = 0
    if not isinstance(data.get("name"), str):
        rep.error(rid, "name 없음")
    rec = data.get("recommended", [])
    if not isinstance(rec, list):
        rep.error(rid, "recommended는 배열")
        rec = []
    seen_boj = False
    for item in rec:
        if not isinstance(item, dict) or set(item) != RECOMMENDED_KEYS:
            rep.error(rid, f"recommended 항목은 site/id/title/level만: {item}")
            continue
        if item["site"] not in ("programmers", "boj") or not isinstance(item["id"], int) or \
                not isinstance(item["title"], str) or not isinstance(item["level"], str):
            rep.error(rid, f"recommended 항목 형식 오류: {item}")
        if item["site"] == "boj":
            seen_boj = True
        elif seen_boj:
            rep.error(rid, "recommended에서 프로그래머스 문제가 백준 문제보다 앞에 와야 함(§7.7)")

    # 레슨
    lessons = {}
    ldir = os.path.join(folder, "lessons")
    for lid in sorted(os.listdir(ldir)) if os.path.isdir(ldir) else []:
        d = check_lesson(rep, runner, rid, os.path.join(ldir, lid))
        if d is not None:
            lessons[lid] = d
    scrolls = {}
    for lid, d in lessons.items():
        sid = d["scroll"]["id"]
        if sid in scrolls:
            rep.error(rid, f"주문서 ID {sid} 중복")
        scrolls[sid] = lid

    # 대사
    dialogues = check_dialogues(rep, f"{rid}/dialogue.json", load_json(rep, os.path.join(folder, "dialogue.json")) or {})
    required = list(REQUIRED_REGION_DIALOGUES.get(rid, []))
    for lid in lessons:
        required += [f"lesson_{lid}_intro", f"lesson_{lid}_done"]
    for k in ("introDialogue", "clearDialogue"):
        if data.get(k):
            required.append(data[k])
    for did in required:
        if did not in dialogues:
            rep.error(f"{rid}/dialogue.json", f"대사 ID {did!r}가 없음")
    overlap = set(dialogues) & set(common_dialogues)
    if overlap:
        rep.error(f"{rid}/dialogue.json", f"공통 대사와 ID가 겹침: {sorted(overlap)}")

    # 문제
    problems = {}
    pdir = os.path.join(folder, "problems")
    for pid in sorted(os.listdir(pdir)) if os.path.isdir(pdir) else []:
        p = check_problem(rep, runner, pool, rid, os.path.join(pdir, pid), scrolls, sprites, order)
        if p is not None:
            problems[pid] = p
    bosses = [pid for pid, p in problems.items() if p["boss"]]
    if len(bosses) != 1:
        rep.error(rid, f"보스 문제는 지역마다 하나: {bosses}")
    elif set(problems[bosses[0]]["requires"]) != set(scrolls):
        rep.error(rid, f"보스 {bosses[0]}의 requires가 지역 주문서 전부가 아님")

    # 명세(region1-spec.md)와 대조
    spec = REQUIRED_REGION_CONTENT.get(rid)
    if spec:
        for lid, sid in spec["lessons"].items():
            if lessons.get(lid, {}).get("scroll", {}).get("id") != sid:
                rep.error(rid, f"명세: 레슨 {lid}의 주문서는 {sid}")
        for pid in spec["problems"]:
            if pid not in problems:
                rep.error(rid, f"명세: 문제 {pid}가 없음")
        if spec["boss"] not in bosses:
            rep.error(rid, f"명세: 보스는 {spec['boss']}")

    # 맵(월드 담당이 만든다. 없으면 건너뜀)
    map_path = os.path.join(folder, "map.tmj")
    if os.path.exists(map_path):
        check_map(rep, rid, map_path, problems, lessons, {**common_dialogues, **dialogues}, scrolls, sprites)
    else:
        rep.warn(rid, "map.tmj가 없어서 맵 오브젝트 참조 검사를 건너뜀")


def main():
    global CONTENT
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("-j", "--jobs", type=int, default=min(8, os.cpu_count() or 2))
    ap.add_argument("--content", default=CONTENT, help="검사할 content 폴더(기본: 저장소의 content/)")
    args = ap.parse_args()
    CONTENT = os.path.abspath(args.content)
    rep = Report(args.verbose)
    runner = Runner(sys.executable)
    print(f"Python {sys.version.split()[0]} ({sys.executable})")
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)
    sprites, portraits = set(manifest["sprites"]), set(manifest["portraits"])

    common = check_dialogues(rep, "common/dialogue.json",
                             load_json(rep, os.path.join(CONTENT, "common", "dialogue.json")) or {})
    for did in REQUIRED_COMMON_DIALOGUES:
        if did not in common:
            rep.error("common/dialogue.json", f"대사 ID {did!r}가 없음")
    check_companion(rep, runner, portraits)

    rdir = os.path.join(CONTENT, "regions")
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for name in sorted(os.listdir(rdir)):
            if os.path.isdir(os.path.join(rdir, name)):
                check_region(rep, runner, pool, os.path.join(rdir, name), sprites, common)

    check_warps(rep, rdir)

    print(f"실행 {runner.count}회, 경고 {len(rep.warnings)}개, 오류 {len(rep.errors)}개")
    print("ALL OK" if not rep.errors else "FAILED")
    sys.exit(1 if rep.errors else 0)


if __name__ == "__main__":
    main()
