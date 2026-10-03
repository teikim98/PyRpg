# PyRpg 채점기(design.md §5.5, §9.4). 워커가 Pyodide FS에 pyrpg_judge.py로 써 두고 import한다.
# 모든 함수는 JSON 문자열만 돌려준다. 큰 정수가 JS를 거치지 않게 비교는 여기서 하고 repr만 넘긴다.
import ast
import bisect
import builtins
import io
import json
import linecache
import os
import sys
import time
import traceback

import pyrpg_io  # 워커가 registerJsModule로 등록(take_stdout)

USER_FILE = "<주문>"
RECURSION_LIMIT = 1000
INT_MAX_STR_DIGITS = 4300
REPR_LIMIT = 4000
MESSAGE_LIMIT = 2000
# 함수 구현형 채점 때의 __name__. "__main__"이 아니어서 if __name__ == "__main__": 블록은 실행되지 않는다
# (tools/verify_content.py HARNESS와 같은 값)
FUNCTION_MODULE_NAME = "solution_module"


_BUILTINS = dict(builtins.__dict__)


def _restore_builtins():
    # builtins.input = ... 처럼 내장 모듈을 고친 것이 다음 테스트·채점기에 남지 않게 한다
    d = builtins.__dict__
    for k in [k for k in d if k not in _BUILTINS]:
        del d[k]
    d.update(_BUILTINS)


def _reopen_std_streams():
    # sys.stdout.close()는 sys.__stdout__ 객체 자체를 닫는다(fd는 closefd=False라 살아 있음).
    # 그대로 두면 워커가 살아 있는 동안 모든 print가 ValueError가 되므로 새 래퍼로 바꾼다
    for name, fd in (("__stdout__", 1), ("__stderr__", 2)):
        s = getattr(sys, name, None)
        if s is None or s.closed:
            try:
                setattr(sys, name, io.open(fd, "w", buffering=1, encoding="utf-8", closefd=False))
            except Exception:
                pass


def _reset_interpreter():
    # dict로 격리되지 않는 인터프리터 상태를 기본값으로 되돌린다(research.md §3.2.8)
    _restore_builtins()
    try:
        sys.setrecursionlimit(RECURSION_LIMIT)
    except Exception:
        pass
    try:
        sys.set_int_max_str_digits(INT_MAX_STR_DIGITS)
    except Exception:
        pass
    # 사용자가 open(0) 등으로 표준 fd를 닫았으면 장치를 다시 연결한다
    for fd, dev, mode in ((0, "/dev/stdin", os.O_RDONLY), (1, "/dev/stdout", os.O_WRONLY), (2, "/dev/stderr", os.O_WRONLY)):
        try:
            os.fstat(fd)
        except OSError:
            try:
                new = os.open(dev, mode)
                if new != fd:
                    os.dup2(new, fd)
                    os.close(new)
            except OSError:
                pass
    _reopen_std_streams()
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    # 테스트마다 새 stdin 래퍼를 연다. 이전 테스트가 남긴 버퍼가 섞이지 않게 한다.
    # fd 0은 워커의 setStdin(read) 핸들러로 이어지고, 그 데이터는 요청마다 바뀐다.
    try:
        sys.stdin = open(0, "r", encoding="utf-8", errors="replace", closefd=False)
    except Exception:
        sys.stdin = io.StringIO("")


def _flush():
    for s in (sys.stdout, sys.stderr, sys.__stdout__, sys.__stderr__):
        try:
            s.flush()
        except BaseException:
            pass


def _register_source(code):
    linecache.cache[USER_FILE] = (len(code), None, code.splitlines(True), USER_FILE)


def _clip(s, limit):
    if len(s) > limit:
        return s[:limit] + "…"
    return s


def _clip_middle(s, limit):
    # Traceback은 마지막 줄(예외 이름과 메시지)이 가장 중요하므로 가운데를 줄인다
    if len(s) <= limit:
        return s
    head = limit // 4
    return s[:head] + "\n  …(중간 생략)…\n" + s[len(s) - (limit - head):]


def _error_info(e):
    """사용자 코드(<주문>) 프레임만 남긴 에러 정보."""
    frames = []
    try:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == USER_FILE]
    except BaseException:
        frames = []
    line = frames[-1].lineno if frames else None
    if isinstance(e, SyntaxError):
        message = e.msg or ""
        if e.filename == USER_FILE and e.lineno:
            line = e.lineno
    else:
        try:
            message = str(e)
        except BaseException:
            message = ""
    text = ""
    try:
        if frames:
            text = "Traceback (most recent call last):\n" + "".join(traceback.format_list(frames))
        text += "".join(traceback.format_exception_only(type(e), e))
    except BaseException:
        text += type(e).__name__ + ": " + message + "\n"
    return {
        "type": type(e).__name__,
        "message": _clip(message, MESSAGE_LIMIT),
        "line": line,
        "traceback": _clip_middle(text, MESSAGE_LIMIT * 2),
    }


def _safe_repr(value):
    try:
        return _clip(repr(value), REPR_LIMIT)
    except BaseException:
        return "<" + type(value).__name__ + ": repr 실패>"


LINE_COUNTER_NAME = "pyrpg-echo-ring"
# inspect.CO_GENERATOR | CO_COROUTINE | CO_ASYNC_GENERATOR
CO_GENERATOR_FLAGS = 0x20 | 0x80 | 0x200


class _LineCounter:
    """메아리 고리(design.md §7.3, docs/phase3/region06-spec.md §7.2): 사용자 코드(<주문>) 줄마다 실행 횟수를 센다.
    sys.monitoring(Python 3.12+)의 지역 이벤트(set_local_events)를 사용자 코드 객체에만 켠다. 채점기·표준 라이브러리에는
    이벤트가 아예 생기지 않으므로 콜백에서 파일을 거를 필요가 없다(빠름).
    - 여러 줄 코드(모듈, 보통 함수): LINE 이벤트로 줄마다 센다. LINE은 같은 줄 안에서 뒤로 점프할 때는 생기지 않으므로
      (한 줄짜리 반복문 `for i in r: s += i`, 리스트·dict·set 컴프리헨션) JUMP 이벤트에서 '같은 줄로 뒤로 점프'를 한 번 더 센다.
    - 한 줄짜리 함수(lambda, def f(x): return x): 몸통이 첫 줄과 같아 LINE 이벤트가 버전마다 다르다(3.12는 생기고 3.14는 없음).
      그래서 LINE은 끄고 호출(PY_START)마다 그 줄을 한 번 센다(sorted의 key=lambda가 몇 번 불렸는지 보이게).
      한 줄짜리 제너레이터(sum(x for x in arr))는 다시 이어질 때(PY_RESUME)도 센다(값을 하나 꺼낼 때마다).
    [예제 실행]에서만 쓰고 [시전]·채점에는 쓰지 않는다(Pyodide에서 약 5~7배 느려짐)."""

    def __init__(self):
        self.counts = {}
        self.tool = None
        self.codes = []
        # 실제로 세기 시작했는지(sys.monitoring이 없거나 도구 자리가 없으면 False → 횟수 없이 지금처럼)
        self.started = False

    @staticmethod
    def _code_objects(module_code):
        out, stack = [], [module_code]
        while stack:
            c = stack.pop()
            out.append(c)
            stack.extend(k for k in c.co_consts if isinstance(k, type(module_code)))
        return out

    @staticmethod
    def _one_line(code):
        if code.co_name == "<module>":
            return False
        first = code.co_firstlineno
        return all(ln is None or ln == first for _s, _e, ln in code.co_lines())

    def start(self, module_code):
        mon = getattr(sys, "monitoring", None)
        if mon is None:
            return False
        # 지난 실행이 정리되지 못하고 남긴 도구(같은 이름)는 먼저 치운다
        for tid in range(6):
            if mon.get_tool(tid) == LINE_COUNTER_NAME:
                self._release(mon, tid, [])
        tool = next((t for t in (mon.COVERAGE_ID, 3, 4, mon.PROFILER_ID) if mon.get_tool(t) is None), None)
        if tool is None:
            return False
        counts = self.counts

        def on_line(_code, line):
            counts[line] = counts.get(line, 0) + 1

        # 코드 객체마다 (시작 오프셋 목록, 줄 목록): 오프셋 → 줄
        line_tables = {}

        def line_at(code, offset):
            table = line_tables.get(code)
            if table is None:
                return None
            starts, lines = table
            i = bisect.bisect_right(starts, offset) - 1
            return lines[i] if i >= 0 else None

        def on_jump(code, src, dest):
            if dest < src:
                line = line_at(code, dest)
                if line is not None and line == line_at(code, src):
                    counts[line] = counts.get(line, 0) + 1

        def on_start(code, _offset):
            first = code.co_firstlineno
            counts[first] = counts.get(first, 0) + 1

        try:
            mon.use_tool_id(tool, LINE_COUNTER_NAME)
            self.tool = tool
            mon.register_callback(tool, mon.events.LINE, on_line)
            mon.register_callback(tool, mon.events.PY_START, on_start)
            mon.register_callback(tool, mon.events.PY_RESUME, on_start)
            mon.register_callback(tool, mon.events.JUMP, on_jump)
            ev = mon.events
            for c in self._code_objects(module_code):
                if not self._one_line(c):
                    events = ev.LINE | ev.JUMP
                    starts, lines = [], []
                    for s0, _e, ln in c.co_lines():
                        starts.append(s0)
                        lines.append(ln)
                    line_tables[c] = (starts, lines)
                elif c.co_flags & CO_GENERATOR_FLAGS:
                    events = ev.PY_START | ev.PY_RESUME
                else:
                    events = ev.PY_START
                mon.set_local_events(tool, c, events)
                self.codes.append(c)
        except BaseException:
            self.stop()
            return False
        self.started = True
        return True

    def stop(self):
        if self.tool is None:
            return
        tool, self.tool = self.tool, None
        codes, self.codes = self.codes, []
        self._release(sys.monitoring, tool, codes)

    @staticmethod
    def _release(mon, tool, codes):
        steps = [lambda c=c: mon.set_local_events(tool, c, 0) for c in codes]
        steps += [
            lambda: mon.set_events(tool, 0),
            lambda: mon.register_callback(tool, mon.events.LINE, None),
            lambda: mon.register_callback(tool, mon.events.PY_START, None),
            lambda: mon.register_callback(tool, mon.events.PY_RESUME, None),
            lambda: mon.register_callback(tool, mon.events.JUMP, None),
            lambda: mon.free_tool_id(tool),
        ]
        for fn in steps:
            try:
                fn()
            except BaseException:
                pass

    def result(self):
        # JSON 키는 문자열(줄 번호)
        return {str(k): v for k, v in sorted(self.counts.items())}


def _exec_user(code, extra=None, module_name="__main__", counter=None):
    """새 globals에서 사용자 코드를 실행한다. (status, error, globals, elapsed_ms)

    status: "ok" | "error" | "timeout"
    counter(_LineCounter)가 있으면 사용자 코드 줄마다 실행 횟수를 센다(메아리 고리).
    """
    _reset_interpreter()
    _register_source(code)
    g = {"__name__": module_name, "__builtins__": builtins}
    status, error = "ok", None
    counting = False
    start = time.perf_counter()
    try:
        compiled = compile(code, USER_FILE, "exec", dont_inherit=True)
        if counter is not None:
            counting = counter.start(compiled)
            start = time.perf_counter()
        exec(compiled, g)
        if extra is not None:
            extra(g)
    except KeyboardInterrupt as e:
        status, error = "timeout", _error_info(e)
    except SystemExit as e:
        # 백준처럼 exit(0)/sys.exit()는 정상 종료로 본다
        if e.code is not None and e.code != 0:
            status, error = "error", _error_info(e)
    except BaseException as e:
        status, error = "error", _error_info(e)
    finally:
        if counting:
            counter.stop()
    elapsed = (time.perf_counter() - start) * 1000.0
    _flush()
    return status, error, g, elapsed


def _with_line_counts(payload, counter, status):
    # 시간 초과(무한루프 등)면 세다 만 횟수는 보이지 않는다(지금처럼 판정만)
    if counter is not None and counter.started and status != "timeout":
        payload["lineCounts"] = counter.result()
    return payload


# 줄 끝에서 무시하는 공백(ASCII). str.rstrip()의 기본값은 유니코드 공백·\x1c~\x1f까지 지워서 JS와 달라지므로 명시한다
LINE_END_SPACE = " \t\r\f\v"


def normalize_output(s):
    """각 줄 끝 공백과 마지막 개행(빈 줄) 차이를 무시한다(§5.5).
    src/python/compare.ts normalizeOutput, tools/verify_content.py norm과 같은 규칙(tests/unit/python-parity.test.ts)."""
    lines = [line.rstrip(LINE_END_SPACE) for line in s.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def run_program(code):
    """자유 실행. stdout은 워커 핸들러가 모은다."""
    status, error, _g, elapsed = _exec_user(code)
    return json.dumps({"status": status, "error": error, "timeMs": elapsed}, ensure_ascii=False)


def run_stdin_test(code, expected, line_counts=False):
    counter = _LineCounter() if line_counts else None
    status, error, _g, elapsed = _exec_user(code, counter=counter)
    actual = pyrpg_io.take_stdout()
    if status == "timeout":
        verdict = "TLE"
    elif status == "error":
        verdict = "RE"
    else:
        verdict = "AC" if normalize_output(actual) == normalize_output(expected) else "WA"
    payload = {"verdict": verdict, "actual": actual, "error": error, "timeMs": elapsed}
    return json.dumps(_with_line_counts(payload, counter, status), ensure_ascii=False)


def sequences_as_lists(v):
    """튜플·리스트를 (중첩까지) 리스트로 바꾼다. 비교 옵션 sequenceAsList용(tools/verify_content.py와 같은 규칙)."""
    if isinstance(v, (list, tuple)):
        return [sequences_as_lists(x) for x in v]
    return v


def results_equal(expected, result, compare=None):
    """함수형 반환값 비교. 기본은 Python ==(True == 1도 같음). compare.sequenceAsList면 튜플과 리스트를 구별하지 않는다."""
    if compare and compare.get("sequenceAsList"):
        return bool(sequences_as_lists(expected) == sequences_as_lists(result))
    return bool(expected == result)


def run_function_test(code, entry, args_src, expect_src, compare_json="", line_counts=False):
    try:
        compare = json.loads(compare_json) if compare_json else None
        args = ast.literal_eval(args_src)
        expected = ast.literal_eval(expect_src)
    except Exception as e:
        info = {"type": "JudgeError", "message": "테스트 데이터 파싱 실패: " + str(e), "line": None, "traceback": ""}
        return json.dumps({"verdict": "RE", "actual": "", "error": info, "timeMs": 0.0}, ensure_ascii=False)
    if not isinstance(args, tuple):
        args = (args,)
    box = {}

    def call(g):
        fn = g.get(entry)
        if not callable(fn):
            raise NameError(f"name '{entry}' is not defined")
        box["result"] = fn(*args)

    counter = _LineCounter() if line_counts else None
    status, error, _g, elapsed = _exec_user(code, call, FUNCTION_MODULE_NAME, counter)
    # 사용자 print 출력은 채점에 쓰지 않고 [예제 실행] 결과에 보여 준다
    stdout = _clip(pyrpg_io.take_stdout() or "", REPR_LIMIT)
    actual = ""
    if status == "timeout":
        verdict = "TLE"
    elif status == "error":
        verdict = "RE"
    elif "result" not in box:
        # exit()로 함수 호출 전에 끝난 경우
        verdict = "WA"
    else:
        result = box["result"]
        actual = _safe_repr(result)
        try:
            same = results_equal(expected, result, compare)
        except BaseException as e:
            same = False
            error = _error_info(e)
        verdict = "AC" if same else "WA"
    payload = {"verdict": verdict, "actual": actual, "error": error, "timeMs": elapsed, "stdout": stdout}
    return json.dumps(_with_line_counts(payload, counter, status), ensure_ascii=False)


def _reference_body():
    # 기준 루프(§9.6, research.md §3.10.3): 반복문과 dict 연산을 섞는다
    s = 0
    for i in range(1_000_000):
        s += i
    d = {}
    for i in range(200_000):
        k = i & 1023
        d[k] = d.get(k, 0) + 1
    return s


def reference(runs):
    times = []
    for _ in range(int(runs)):
        start = time.perf_counter()
        _reference_body()
        times.append((time.perf_counter() - start) * 1000.0)
    return json.dumps(times)


def generate_test(code, arg):
    """큰 입력 생성기(design.md §11.1)를 실행해서 {"in", "out"} JSON을 돌려준다. 콘텐츠 파일이라 사용자 코드가 아니다.
    tools/verify_content.py generate_test와 같은 규칙: 새 globals에서 실행하고, generate(arg)가 (입력, 출력) 문자열 튜플을 돌려준다."""
    g = {"__name__": "pyrpg_gen", "__builtins__": builtins}
    exec(compile(code, "<gen>", "exec", dont_inherit=True), g)
    result = g["generate"](arg)
    if not (isinstance(result, tuple) and len(result) == 2 and all(isinstance(x, str) for x in result)):
        raise TypeError("generate(arg)는 (입력, 출력) 문자열 튜플을 돌려줘야 함")
    return json.dumps({"in": result[0], "out": result[1]}, ensure_ascii=False)
