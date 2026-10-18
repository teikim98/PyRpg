"""선행 지식 검사(design.md §12.1, docs/phase3/improvements-plan.md §4).

레슨마다 lesson.json의 introduces(그 레슨이 처음 소개하는 태그)를 모아 '학습 시점'을 만들고, Python ast로
코드가 쓰는 문법·내장 함수·메서드·모듈을 태그로 뽑아 대조한다. 코드는 실행하지 않고 파싱만 한다.

학습 시점(허용 목록)
- 문제: 이전 지역의 모든 레슨 + 같은 지역에서 requires가 가리키는 레슨 가운데 가장 뒤 번호(숫자 순서)까지의 레슨
  + 그 문제 starter.py의 태그 + problem.json의 prereqExceptions
- 레슨: 이전 지역 + 같은 지역 앞 레슨 + 자기 introduces + lesson.json의 prereqExceptions
  (레슨 안에서는 에러 메시지를 보여 주는 try(try-show-error)도 허용)
검사
- 오류: solution.py, 레슨의 ```python·```python run 블록과 빈칸 연습(정답을 넣은 코드),
  introduces 형식·중복(같은 태그는 전체에서 한 레슨만), prereqExceptions 형식(reason 필수)·남용(막은 위반이 없음)
- 경고: 힌트(펜스 블록·인라인 코드), 보스 slow.py, introduces인데 레슨 어디에도 안 보이는 태그,
  태그 규칙이 없는 문법(검사기에 규칙을 더할 것)
- 검사하지 않음: alt_*.py, wrong_*.py, 해설, 지문, 변형. 파싱에 실패한 레슨 블록(문법 오류를 보여 주는 예제)과 ```js compare

태그 어휘(TAG_PREFIXES, SYNTAX_TAGS): call:<내장 함수>, method:<이름>(자료형 추론 없이 이름만 본다. 알려진 한계),
import:<모듈>, api:<모듈>.<경로>, kwarg:<이름>, op:<기호>와 고정 문법 태그.

사용법:
  python tools/prereq.py check [-v] [--regions DIR] [--introduces-file JSON]
  python tools/prereq.py draft <레슨 폴더> [--introduces-file JSON]
verify_content.py는 check_all(rep, regions_dir)을 부른다.
"""
import argparse
import ast
import builtins
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGIONS = os.path.join(ROOT, "content", "regions")

# ---------------------------------------------------------------- 어휘

TAG_PREFIXES = ("call:", "method:", "import:", "api:", "kwarg:", "op:")
OPS = {
    ast.FloorDiv: "//", ast.Mod: "%", ast.Pow: "**", ast.Div: "/", ast.BitAnd: "&", ast.BitOr: "|",
    ast.BitXor: "^", ast.LShift: "<<", ast.RShift: ">>",
}
OP_SYMBOLS = frozenset(OPS.values()) | {"~", "is"}
SYNTAX_TAGS = frozenset({
    # 조건·반복
    "if", "elif", "ternary", "and", "or", "not", "chain-compare", "in", "not-in",
    "for", "for-iter", "while", "break", "continue", "nested-loop", "loop-else", "unpack-for",
    # 대입
    "augassign", "unpack-assign", "tuple-assign", "subscript-unpack", "starred-assign", "walrus", "annotation",
    # 인덱스·슬라이스
    "subscript", "neg-index", "subscript-store", "slice", "slice-step", "del",
    # 자료 리터럴·내포
    "list-literal", "tuple-literal", "dict-literal", "set-literal", "list-mult", "starred-literal", "dstar-literal",
    "listcomp", "setcomp", "dictcomp", "genexp", "nested-comp", "comp-if",
    # 문자열
    "fstring", "fstring-format",
    # 호출
    "starred-call", "dstar-call", "kwarg-user",
    # 함수
    "def", "return", "def-default", "def-star", "nested-def", "recursion", "lambda", "decorator", "global", "nonlocal",
    # 모듈
    "from-import",
    # 예외·그 밖
    "try", "try-show-error", "raise", "assert", "with", "class", "yield",
})
# 레슨 안에서 저절로 허용되는 태그(introduces에 적지 않는다)
LESSON_ONLY_TAGS = frozenset({"try-show-error"})
BUILTIN_NAMES = frozenset(n for n in dir(builtins) if not n.startswith("_"))
# 코드 조각(힌트·인라인 코드)은 import 줄이 없으므로 이 이름을 모듈로 읽는다(sys.x를 method:x로 읽지 않게)
FRAGMENT_MODULES = ("sys", "collections", "math", "functools", "itertools", "heapq", "bisect", "re", "string",
                    "random", "copy", "operator")
IDENT = r"[A-Za-z_][A-Za-z0-9_]*"
_TAG_FORMS = {
    "call:": lambda s: s in BUILTIN_NAMES,
    "method:": lambda s: re.fullmatch(IDENT, s) is not None,
    "kwarg:": lambda s: re.fullmatch(IDENT, s) is not None,
    "import:": lambda s: re.fullmatch(rf"{IDENT}(\.{IDENT})*", s) is not None,
    "api:": lambda s: re.fullmatch(rf"{IDENT}(\.{IDENT})+", s) is not None,
    "op:": lambda s: s in OP_SYMBOLS,
}


def valid_tag(tag):
    """어휘에 있는 태그 형식인지."""
    if not isinstance(tag, str):
        return False
    if tag in SYNTAX_TAGS:
        return True
    for prefix, ok in _TAG_FORMS.items():
        if tag.startswith(prefix):
            return ok(tag[len(prefix):])
    return False


# ---------------------------------------------------------------- 태거

# 태그를 만들지 않는 바탕 노드(이름, 상수, 단순 대입, + - *, 기본 비교 등). 연산자 노드는 부모에서 판정한다
BASIC_NODES = (
    ast.Module, ast.Expr, ast.Name, ast.Constant, ast.Pass, ast.keyword, ast.arguments, ast.alias,
    ast.comprehension, ast.ExceptHandler, ast.withitem, ast.Slice, ast.FormattedValue,
    ast.expr_context, ast.operator, ast.unaryop, ast.cmpop, ast.boolop,
)


class Tagger(ast.NodeVisitor):
    """코드 → {태그: 줄 번호 집합}. 규칙이 없는 노드는 unknown에 {노드 이름: 줄 번호 집합}으로 모은다."""

    def __init__(self, modules=(), lesson=False, defined=()):
        self.tags = {}
        self.unknown = {}
        self.modules = {m: m for m in modules}   # 이름 → 모듈 경로
        self.from_names = {}                     # from X import Y의 Y → "X.Y"
        self.lesson = lesson
        self.defined = set(defined)              # 코드 안에서 정의한 함수 이름(내장 함수 호출로 읽지 않음)
        self.loop_depth = 0
        self.func_stack = []
        self.call_starred = set()

    def add(self, tag, node):
        self.tags.setdefault(tag, set()).add(getattr(node, "lineno", 0))

    def unknown_node(self, name, node):
        self.unknown.setdefault(name, set()).add(getattr(node, "lineno", 0))

    def visit(self, node):
        method = getattr(self, "visit_" + type(node).__name__, None)
        if method is not None:
            return method(node)
        if not isinstance(node, BASIC_NODES):
            self.unknown_node(type(node).__name__, node)
        return self.generic_visit(node)

    # ---- import
    def visit_Import(self, node):
        for a in node.names:
            self.add(f"import:{a.name}", node)
            if a.asname:
                self.modules[a.asname] = a.name
            else:
                root = a.name.split(".")[0]
                self.modules[root] = root

    def visit_ImportFrom(self, node):
        mod = node.module or ""
        self.add("from-import", node)
        self.add(f"import:{mod}", node)
        for a in node.names:
            if a.name == "*":
                self.unknown_node("ImportFrom *", node)
                continue
            self.from_names[a.asname or a.name] = f"{mod}.{a.name}"
            self.add(f"api:{mod}.{a.name}", node)

    @staticmethod
    def _dotted(node):
        parts = []
        while isinstance(node, ast.Attribute):
            parts.append(node.attr)
            node = node.value
        if isinstance(node, ast.Name):
            parts.append(node.id)
            return parts[::-1]
        return None

    def _api(self, dotted):
        if dotted and dotted[0] in self.modules:
            return ".".join([self.modules[dotted[0]]] + dotted[1:])
        if dotted and dotted[0] in self.from_names:
            return ".".join([self.from_names[dotted[0]]] + dotted[1:])
        return None

    # ---- 이름·속성·호출
    def visit_Attribute(self, node):
        api = self._api(self._dotted(node))
        if api is not None:
            self.add("api:" + api, node)
            return  # 안쪽 Attribute를 다시 보지 않음
        self.generic_visit(node)

    def visit_Name(self, node):
        if node.id in self.from_names and isinstance(node.ctx, ast.Load):
            self.add("api:" + self.from_names[node.id], node)

    def visit_Call(self, node):
        f = node.func
        if isinstance(f, ast.Name):
            if f.id in self.func_stack:
                self.add("recursion", node)
            elif f.id in BUILTIN_NAMES and f.id not in self.defined and f.id not in self.from_names:
                self.add(f"call:{f.id}", node)
        elif isinstance(f, ast.Attribute) and self._api(self._dotted(f)) is None:
            self.add(f"method:{f.attr}", node)
        for a in node.args:
            if isinstance(a, ast.Starred):
                self.add("starred-call", a)
                self.call_starred.add(id(a))
        user = isinstance(f, ast.Name) and f.id in self.defined
        for k in node.keywords:
            if k.arg is None:
                self.add("dstar-call", k)
            elif user:
                self.add("kwarg-user", k)
            else:
                self.add(f"kwarg:{k.arg}", k)
        self.generic_visit(node)

    # ---- 함수
    def visit_FunctionDef(self, node):
        self.add("def", node)
        if self.func_stack:
            self.add("nested-def", node)  # 재귀가 아닌 도우미도(P0610 compress)
        if node.decorator_list:
            self.add("decorator", node)
        a = node.args
        if a.defaults or any(x is not None for x in a.kw_defaults):
            self.add("def-default", node)
        if a.vararg or a.kwarg:
            self.add("def-star", node)
        if node.returns is not None:
            self.add("annotation", node)
        for d in node.decorator_list:
            self.visit(d)
        self.visit(node.args)
        self.func_stack.append(node.name)
        saved, self.loop_depth = self.loop_depth, 0
        for s in node.body:
            self.visit(s)
        self.loop_depth = saved
        self.func_stack.pop()

    def visit_arg(self, node):
        if node.annotation is not None:
            self.add("annotation", node)

    def visit_Return(self, node):
        self.add("return", node)
        if isinstance(node.value, ast.Tuple):
            self.add("tuple-literal", node)
            for e in node.value.elts:
                self.visit(e)
        elif node.value is not None:
            self.visit(node.value)

    def visit_Lambda(self, node):
        self.add("lambda", node)
        self.generic_visit(node)

    def visit_Global(self, node):
        self.add("global", node)

    def visit_Nonlocal(self, node):
        self.add("nonlocal", node)

    # ---- 흐름
    def visit_If(self, node):
        self.add("if", node)
        orelse = node.orelse
        if len(orelse) == 1 and isinstance(orelse[0], ast.If) and orelse[0].col_offset == node.col_offset:
            self.add("elif", orelse[0])
        self.generic_visit(node)

    def _loop(self, node, tag):
        self.add(tag, node)
        if self.loop_depth:
            self.add("nested-loop", node)
        if node.orelse:
            self.add("loop-else", node)
        self.loop_depth += 1
        for s in node.body:
            self.visit(s)
        self.loop_depth -= 1
        for s in node.orelse:
            self.visit(s)

    def visit_For(self, node):
        it = node.iter
        is_range = isinstance(it, ast.Call) and isinstance(it.func, ast.Name) and it.func.id == "range"
        if isinstance(node.target, (ast.Tuple, ast.List)):
            self.add("unpack-for", node)
        self.visit(node.target)
        self.visit(node.iter)
        self._loop(node, "for" if is_range else "for-iter")

    def visit_While(self, node):
        self.visit(node.test)
        self._loop(node, "while")

    def visit_Break(self, node):
        self.add("break", node)

    def visit_Continue(self, node):
        self.add("continue", node)

    def visit_Try(self, node):
        self.add("try-show-error" if self.lesson and shows_error(node) else "try", node)
        self.generic_visit(node)

    def visit_TryStar(self, node):
        self.add("try", node)
        self.generic_visit(node)

    def visit_Raise(self, node):
        self.add("raise", node)
        self.generic_visit(node)

    def visit_With(self, node):
        self.add("with", node)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self.add("class", node)
        self.generic_visit(node)

    def visit_Yield(self, node):
        self.add("yield", node)
        self.generic_visit(node)

    visit_YieldFrom = visit_Yield

    def visit_Assert(self, node):
        self.add("assert", node)
        self.generic_visit(node)

    def visit_Delete(self, node):
        self.add("del", node)
        self.generic_visit(node)

    def visit_NamedExpr(self, node):
        self.add("walrus", node)
        self.generic_visit(node)

    def visit_IfExp(self, node):
        self.add("ternary", node)
        self.generic_visit(node)

    # ---- 대입
    def visit_Assign(self, node):
        value_seq = isinstance(node.value, (ast.Tuple, ast.List))
        for t in node.targets:
            if isinstance(t, ast.Tuple) and value_seq:
                # n, m = 3, 4 / arr[i], arr[j] = arr[j], arr[i]: 오른쪽은 튜플 리터럴로 치지 않는다
                self.add("subscript-unpack" if any(isinstance(e, ast.Subscript) for e in t.elts)
                         else "tuple-assign", node)
            elif isinstance(t, (ast.Tuple, ast.List)):
                self.add("unpack-assign", node)
            self.visit(t)
        if value_seq and any(isinstance(t, ast.Tuple) for t in node.targets):
            for e in node.value.elts:
                self.visit(e)
        else:
            self.visit(node.value)

    def visit_AnnAssign(self, node):
        self.add("annotation", node)
        self.visit(node.target)
        if node.value is not None:
            self.visit(node.value)

    def visit_AugAssign(self, node):
        self.add("augassign", node)
        self._op(node.op, node)
        self.visit(node.target)
        self.visit(node.value)

    def visit_Starred(self, node):
        if isinstance(node.ctx, ast.Store):
            self.add("starred-assign", node)
        elif id(node) not in self.call_starred:
            self.add("starred-literal", node)
        self.generic_visit(node)

    # ---- 식
    def _op(self, op, node):
        if type(op) in OPS:
            self.add(f"op:{OPS[type(op)]}", node)
        elif not isinstance(op, (ast.Add, ast.Sub, ast.Mult)):
            self.unknown_node(type(op).__name__, node)

    def visit_BinOp(self, node):
        self._op(node.op, node)
        if isinstance(node.op, ast.Mult) and (isinstance(node.left, ast.List) or isinstance(node.right, ast.List)):
            self.add("list-mult", node)
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        self.add("and" if isinstance(node.op, ast.And) else "or", node)
        self.generic_visit(node)

    def visit_UnaryOp(self, node):
        if isinstance(node.op, ast.Not):
            self.add("not", node)
        elif isinstance(node.op, ast.Invert):
            self.add("op:~", node)
        self.generic_visit(node)

    def visit_Compare(self, node):
        if len(node.ops) > 1:
            self.add("chain-compare", node)
        for op in node.ops:
            if isinstance(op, ast.In):
                self.add("in", node)
            elif isinstance(op, ast.NotIn):
                self.add("not-in", node)
            elif isinstance(op, (ast.Is, ast.IsNot)):
                self.add("op:is", node)
        self.generic_visit(node)

    def visit_Subscript(self, node):
        sl = node.slice
        if isinstance(sl, ast.Slice):
            self.add("slice", node)
            if sl.step is not None:
                self.add("slice-step", node)
        else:
            self.add("subscript", node)
            if isinstance(sl, ast.UnaryOp) and isinstance(sl.op, ast.USub):
                self.add("neg-index", node)
        if isinstance(node.ctx, ast.Store):
            self.add("subscript-store", node)
        self.generic_visit(node)

    def visit_JoinedStr(self, node):
        self.add("fstring", node)
        for v in node.values:
            if isinstance(v, ast.FormattedValue):
                if v.format_spec is not None:
                    self.add("fstring-format", v)
                self.visit(v.value)

    def visit_List(self, node):
        if isinstance(node.ctx, ast.Load):
            self.add("list-literal", node)
        self.generic_visit(node)

    def visit_Tuple(self, node):
        if isinstance(node.ctx, ast.Load):
            self.add("tuple-literal", node)
        self.generic_visit(node)

    def visit_Dict(self, node):
        self.add("dict-literal", node)
        if any(k is None for k in node.keys):
            self.add("dstar-literal", node)
        self.generic_visit(node)

    def visit_Set(self, node):
        self.add("set-literal", node)
        self.generic_visit(node)

    def _comp(self, node, tag):
        self.add(tag, node)
        if len(node.generators) > 1:
            self.add("nested-comp", node)
        for g in node.generators:
            if g.ifs:
                self.add("comp-if", node)
            if isinstance(g.target, (ast.Tuple, ast.List)):
                self.add("unpack-for", node)
            if g.is_async:
                self.unknown_node("async comprehension", node)
        self.generic_visit(node)

    def visit_ListComp(self, node):
        self._comp(node, "listcomp")

    def visit_SetComp(self, node):
        self._comp(node, "setcomp")

    def visit_DictComp(self, node):
        self._comp(node, "dictcomp")

    def visit_GeneratorExp(self, node):
        self._comp(node, "genexp")


def shows_error(node):
    """레슨이 에러 메시지를 보여 주려고 감싼 try인지: else·finally 없음, except마다 예외 이름, except 본문은 print(...)뿐."""
    if node.orelse or node.finalbody or not node.handlers:
        return False
    for h in node.handlers:
        if h.type is None:
            return False
        for s in h.body:
            if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Call)
                    and isinstance(s.value.func, ast.Name) and s.value.func.id == "print"):
                return False
    return True


def analyze(code, modules=(), lesson=False):
    """코드 → (태그 dict, 규칙 없는 노드 dict). 파싱 실패면 SyntaxError."""
    tree = ast.parse(code)
    defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    t = Tagger(modules, lesson, defined)
    t.visit(tree)
    return t.tags, t.unknown


def code_tags(code, modules=(), lesson=False):
    """코드 → {태그: 줄 번호 집합}. 파싱 실패면 SyntaxError."""
    return analyze(code, modules, lesson)[0]


# ---------------------------------------------------------------- 코드 조각 뽑기

FENCE = re.compile(r"^```(python(?: run)?)[ \t]*\n(.*?)^```[ \t]*$", re.S | re.M)
ANY_FENCE = re.compile(r"^```.*?^```[ \t]*$", re.S | re.M)
INLINE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")
BRACES_ONLY = re.compile(r"\s*\{[^{}]*\}\s*")   # `{}`, `{n:03d}`: f-string 중괄호 설명
BLANK = re.compile(r"_{3,}")


def fenced_blocks(text):
    """```python / ```python run 블록 → [(코드 첫 줄 번호, 코드)]."""
    return [(text.count("\n", 0, m.start(2)) + 1, m.group(2)) for m in FENCE.finditer(text)]


def inline_snippets(text):
    """펜스 밖의 `인라인 코드` → [(줄 번호, 코드)]. 중괄호 하나뿐인 것은 뺀다."""
    plain = ANY_FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    return [(plain.count("\n", 0, m.start()) + 1, m.group(1)) for m in INLINE.finditer(plain)
            if not BRACES_ONLY.fullmatch(m.group(1))]


def fragment_analysis(code, modules=FRAGMENT_MODULES):
    """힌트·인라인 코드 조각 → (태그, 규칙 없는 노드) 또는 None(파싱 실패).
    빈칸 ____은 이름으로 바꾸고 빈칸 자리의 태그(method:BLANK 등)는 버린다. `.split()`처럼 점으로 시작하면 이름을 붙인다."""
    code = BLANK.sub("BLANK", code.strip())
    if code.startswith("."):
        code = "x" + code
    try:
        tags, unknown = analyze(code, modules)
    except (SyntaxError, ValueError):
        return None
    return {k: v for k, v in tags.items() if "BLANK" not in k}, unknown


# ---------------------------------------------------------------- 콘텐츠 읽기

def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _lesson_num(lid):
    m = re.fullmatch(r"L\d+-(\d+)", lid)
    return int(m.group(1)) if m else 10 ** 6


def load_regions(regions_dir):
    """지역 폴더(이름 순서 = 지역 순서) → [{rid, folder, lessons: [...], problems: [...]}]. 형식이 깨진 파일은 건너뛴다
    (형식 검사는 verify_content.py가 한다)."""
    out = []
    for name in sorted(os.listdir(regions_dir)):
        folder = os.path.join(regions_dir, name)
        if not os.path.isdir(folder):
            continue
        rj = _json(os.path.join(folder, "region.json")) or {}
        rid = rj.get("id") if isinstance(rj.get("id"), str) else name[:3]
        lessons = []
        ldir = os.path.join(folder, "lessons")
        for lid in sorted(os.listdir(ldir) if os.path.isdir(ldir) else [], key=lambda s: (_lesson_num(s), s)):
            lf = os.path.join(ldir, lid)
            data = _json(os.path.join(lf, "lesson.json"))
            if not isinstance(data, dict) or not os.path.exists(os.path.join(lf, "lesson.md")):
                continue
            scroll = data.get("scroll") if isinstance(data.get("scroll"), dict) else {}
            lessons.append({"rid": rid, "id": lid, "folder": lf, "data": data, "md": _read(os.path.join(lf, "lesson.md")),
                            "scroll": scroll.get("id"), "summary": scroll.get("summary") or ""})
        problems = []
        pdir = os.path.join(folder, "problems")
        for pid in sorted(os.listdir(pdir) if os.path.isdir(pdir) else []):
            pf = os.path.join(pdir, pid)
            data = _json(os.path.join(pf, "problem.json"))
            if isinstance(data, dict):
                problems.append({"rid": rid, "id": pid, "folder": pf, "data": data})
        out.append({"rid": rid, "folder": folder, "lessons": lessons, "problems": problems})
    return out


def lesson_code(lesson):
    """레슨의 검사 대상 코드 → [(이름, md 기준 줄 번호 보정값, 코드)]: python 블록과 빈칸 연습(정답을 넣은 코드)."""
    out = [(f"lesson.md:{line}", line - 1, code) for line, code in fenced_blocks(lesson["md"])]
    ex = lesson["data"].get("exercise")
    if isinstance(ex, dict) and isinstance(ex.get("code"), str) and isinstance(ex.get("answer"), str):
        out.append(("빈칸 연습", 0, ex["code"].replace("___", ex["answer"])))
    return out


def lesson_shown(lesson):
    """레슨이 보여 주는 태그 → 출처 목록(코드 블록, 빈칸 연습, 본문·summary 인라인 코드)."""
    shown = {}
    for name, offset, code in lesson_code(lesson):
        try:
            tags = code_tags(code, lesson=True)
        except (SyntaxError, ValueError):
            continue
        for t, lines in tags.items():
            src = name if name == "빈칸 연습" else f"블록 :{min(lines) + offset}"
            shown.setdefault(t, []).append(src)
    for label, text in (("본문", lesson["md"]), ("summary", lesson["summary"])):
        for line, code in inline_snippets(text):
            r = fragment_analysis(code)
            if r is None:
                continue
            for t in r[0]:
                shown.setdefault(t, []).append(f"인라인 :{line}" if label == "본문" else "summary")
    shown.pop("try-show-error", None)
    return shown


# ---------------------------------------------------------------- 검사

def _exceptions(rep, where, data):
    """prereqExceptions 형식 검사 → {태그: 사용 횟수(0)}."""
    raw = data.get("prereqExceptions")
    if raw is None:
        return {}
    if not isinstance(raw, list):
        rep.error(where, "prereqExceptions는 [{\"tag\", \"reason\"}] 배열")
        return {}
    out = {}
    for i, e in enumerate(raw):
        if not isinstance(e, dict) or set(e) != {"tag", "reason"}:
            rep.error(where, f"prereqExceptions[{i}]는 tag와 reason만 가진 객체: {e!r}")
            continue
        if not valid_tag(e["tag"]):
            rep.error(where, f"prereqExceptions[{i}]의 태그 {e['tag']!r}: 어휘에 없음")
            continue
        if not isinstance(e["reason"], str) or not e["reason"].strip():
            rep.error(where, f"prereqExceptions[{i}]({e['tag']})의 reason이 비어 있음. 왜 예외인지 적을 것")
            continue
        if e["tag"] in out:
            rep.error(where, f"prereqExceptions에 같은 태그 {e['tag']} 두 번")
            continue
        out[e["tag"]] = 0
    return out


class _Checker:
    def __init__(self, rep, regions, override):
        self.rep = rep
        self.regions = regions
        self.override = override or {}
        self.intro = {}        # 레슨 ID → introduces 목록
        self.first = {}        # 태그 → 처음 소개한 레슨 ID
        self.exception_count = 0

    def where(self, item):
        return f"{item['rid']}/{item['id']}"

    def who(self, tag):
        return self.first.get(tag, "소개 없음")

    def fmt(self, bad, offset=0, lines=True):
        return ", ".join(
            f"{t}@{','.join(str(n + offset) for n in sorted(ls))}({self.who(t)})" if lines else f"{t}({self.who(t)})"
            for t, ls in sorted(bad.items()))

    def unknown(self, where, name, unknown, offset=0):
        for node, ls in sorted(unknown.items()):
            at = ",".join(str(n + offset) for n in sorted(ls))
            self.rep.warn(where, f"{name}:{at} 태그 규칙이 없는 문법 {node}(tools/prereq.py에 규칙을 더할 것)")

    @staticmethod
    def violations(tags, allowed, exceptions):
        bad = {}
        for t, ls in tags.items():
            if t in allowed:
                continue
            if t in exceptions:
                exceptions[t] += 1
                continue
            bad[t] = ls
        return bad

    def exceptions_unused(self, where, exceptions):
        self.exception_count += len(exceptions)
        for t, used in exceptions.items():
            if used:
                self.rep.info(f"{where}: 예외 {t}: 위반 {used}곳을 막음")
            else:
                self.rep.error(where, f"prereqExceptions의 {t}: 막은 위반이 없음(지울 것)")

    # ---- introduces
    def read_introduces(self):
        """형식 검사. 모든 레슨에 있으면 True."""
        complete = True
        for reg in self.regions:
            for les in reg["lessons"]:
                where = self.where(les)
                tags = self.override.get(les["id"], les["data"].get("introduces"))
                if tags is None:
                    self.rep.error(where, "lesson.json에 introduces가 없음(모든 레슨에 필수, 소개할 것이 없으면 [])")
                    complete = False
                    continue
                if not isinstance(tags, list):
                    self.rep.error(where, "introduces는 태그 문자열 배열")
                    complete = False
                    continue
                good = []
                for t in tags:
                    if t in LESSON_ONLY_TAGS:
                        self.rep.error(where, f"introduces의 {t}: 레슨 안에서 저절로 허용되는 태그라 적지 않음")
                    elif not valid_tag(t):
                        self.rep.error(where, f"introduces의 {t!r}: 어휘에 없는 태그(tools/prereq.py SYNTAX_TAGS·TAG_PREFIXES)")
                    elif t in good:
                        self.rep.error(where, f"introduces에 같은 태그 {t} 두 번")
                    elif t in self.first:
                        self.rep.error(where, f"introduces의 {t}: 이미 {self.first[t]}에서 소개함(같은 태그는 한 레슨만)")
                    else:
                        good.append(t)
                        self.first[t] = les["id"]
                self.intro[les["id"]] = good
        return complete

    # ---- 레슨
    def check_lesson(self, les, known):
        where = self.where(les)
        own = set(self.intro[les["id"]])
        shown = lesson_shown(les)
        for t in sorted(own - set(shown)):
            self.rep.warn(where, f"introduces의 {t}: 레슨 코드 블록·빈칸 연습·인라인 코드·summary 어디에도 안 보임")
        exceptions = _exceptions(self.rep, where, les["data"])
        allowed = known | own | LESSON_ONLY_TAGS
        for name, offset, code in lesson_code(les):
            try:
                tags, unknown = analyze(code, lesson=True)
            except (SyntaxError, ValueError):
                self.rep.info(f"{where}: {name} 파싱 실패, 건너뜀")
                continue
            exercise = name == "빈칸 연습"
            self.unknown(where, name if exercise else "lesson.md", unknown, offset)
            bad = self.violations(tags, allowed, exceptions)
            if bad:
                what = "빈칸 연습(정답을 넣은 코드)이" if exercise else f"{name} 블록이"
                self.rep.error(where, f"{what} 아직 소개되지 않은 것을 씀: {self.fmt(bad, offset)}")
        self.exceptions_unused(where, exceptions)

    # ---- 문제
    def check_problem(self, prob, region_lessons, prior):
        where = self.where(prob)
        data, folder = prob["data"], prob["folder"]
        by_scroll = {les["scroll"]: les for les in region_lessons}
        req = [by_scroll[s] for s in data.get("requires") or [] if isinstance(s, str) and s in by_scroll]
        upto = max((_lesson_num(les["id"]) for les in req), default=None)
        allowed = set(prior)
        for les in region_lessons:
            if upto is not None and _lesson_num(les["id"]) <= upto:
                allowed |= set(self.intro[les["id"]])
        point = f"{max(req, key=lambda les: _lesson_num(les['id']))['id']}까지" if req else "이전 지역까지"
        starter_path = os.path.join(folder, "starter.py")
        if os.path.exists(starter_path):
            try:
                allowed |= set(code_tags(_read(starter_path)))
            except (SyntaxError, ValueError):
                pass
        self.rep.info(f"{where}: 학습 시점 {point}")
        exceptions = _exceptions(self.rep, where, data)
        modules = set()

        sol_path = os.path.join(folder, "solution.py")
        if os.path.exists(sol_path):
            try:
                tags, unknown = analyze(_read(sol_path))
            except (SyntaxError, ValueError):
                tags, unknown = {}, {}
            modules = {t.split(":", 1)[1].split(".")[0] for t in tags if t.startswith("import:")}
            self.unknown(where, "solution.py", unknown)
            bad = self.violations(tags, allowed, exceptions)
            if bad:
                self.rep.error(where, f"solution.py가 학습 시점({point}) 밖의 것을 씀: {self.fmt(bad)}")

        slow_path = os.path.join(folder, "slow.py")
        if os.path.exists(slow_path):
            try:
                tags, unknown = analyze(_read(slow_path))
            except (SyntaxError, ValueError):
                tags, unknown = {}, {}
            self.unknown(where, "slow.py", unknown)
            bad = self.violations(tags, allowed, exceptions)
            if bad:
                self.rep.warn(where, f"slow.py(비효율 답안)가 학습 시점({point}) 밖의 것을 씀: {self.fmt(bad)}")

        frag_modules = tuple(sorted(set(FRAGMENT_MODULES) | modules))
        for i, hint in enumerate(data.get("hints") or [], 1):
            if not isinstance(hint, str):
                continue
            tags, unknown = {}, {}
            for _, code in fenced_blocks(hint) + inline_snippets(hint):
                r = fragment_analysis(code, frag_modules)
                if r is None:
                    continue
                for t, ls in r[0].items():
                    tags.setdefault(t, set()).update(ls)
                for n, ls in r[1].items():
                    unknown.setdefault(n, set()).update(ls)
            for n in sorted(unknown):
                self.rep.warn(where, f"힌트 {i}: 태그 규칙이 없는 문법 {n}(tools/prereq.py에 규칙을 더할 것)")
            bad = self.violations(tags, allowed, exceptions)
            if bad:
                self.rep.warn(where, f"힌트 {i}{'가' if i % 10 in (2, 4, 5, 9) else '이'} 학습 시점({point}) 밖의 것을 씀: {self.fmt(bad, lines=False)}")
        self.exceptions_unused(where, exceptions)

    def run(self):
        if not self.read_introduces():
            return False
        known = set()
        for reg in self.regions:
            prior = set(known)
            for les in reg["lessons"]:
                self.check_lesson(les, known)
                known |= set(self.intro[les["id"]])
            for prob in reg["problems"]:
                self.check_problem(prob, reg["lessons"], prior)
        return True


def check_all(rep, regions_dir, introduces_override=None):
    """지역 폴더 전체를 검사해 rep(verify_content.Report와 같은 error/warn/info)에 넣고 요약 한 줄을 출력한다.
    introduces_override: {레슨 ID: [태그]}가 있으면 그 레슨의 lesson.json introduces 대신 쓴다(비교용)."""
    e0, w0 = len(rep.errors), len(rep.warnings)
    regions = load_regions(regions_dir)
    n_lessons = sum(len(r["lessons"]) for r in regions)
    n_problems = sum(len(r["problems"]) for r in regions)
    print(f"[선행 지식] 레슨 {n_lessons}개 · 문제 {n_problems}개")
    checker = _Checker(rep, regions, introduces_override)
    complete = checker.run()
    errors, warnings = len(rep.errors) - e0, len(rep.warnings) - w0
    tail = "" if complete else " (introduces가 없는 레슨이 있어서 학습 시점 대조를 건너뜀)"
    print(f"[선행 지식] 오류 {errors} · 경고 {warnings} · 예외 {checker.exception_count}{tail}")
    return {"errors": errors, "warnings": warnings, "exceptions": checker.exception_count, "complete": complete}


# ---------------------------------------------------------------- 소개 후보(draft)

def draft(lesson_folder, introduces_override=None):
    """레슨 하나의 introduces 후보: 레슨이 보여 주는 태그 - 앞 레슨이 이미 소개한 태그.
    introduces가 아직 없는 레슨은 '그 레슨이 보여 주는 태그'를 소개한 것으로 친다(추정, 출력에 표시)."""
    lesson_folder = os.path.abspath(lesson_folder)
    lid = os.path.basename(lesson_folder)
    regions_dir = os.path.dirname(os.path.dirname(os.path.dirname(lesson_folder)))
    regions = load_regions(regions_dir)
    order = [les for reg in regions for les in reg["lessons"]]
    idx = next((i for i, les in enumerate(order) if les["id"] == lid), None)
    if idx is None:
        print(f"{lesson_folder}에서 레슨을 찾지 못함(lesson.json, lesson.md 필요)")
        return 1
    lesson = order[idx]
    override = introduces_override or {}
    first, guessed = {}, []
    for i, les in enumerate(order):
        if i == idx:
            continue
        tags = override.get(les["id"], les["data"].get("introduces"))
        if not isinstance(tags, list):
            if i > idx:
                continue
            tags = sorted(lesson_shown(les))
            guessed.append(les["id"])
        for t in tags:
            first.setdefault(t, les["id"])
    shown = lesson_shown(lesson)
    earlier = {les["id"] for les in order[:idx]}
    candidates, already, later = [], [], []
    for t in sorted(shown):
        owner = first.get(t)
        if owner in earlier:
            already.append(t)
        elif owner is not None:
            later.append(t)
        else:
            candidates.append(t)
    print(f"{lesson['rid']}/{lid} 소개 후보(레슨이 보여 주는 태그 - 앞 레슨이 이미 소개한 태그)")
    if guessed:
        print(f"  introduces가 없는 앞 레슨({', '.join(guessed)})은 레슨이 보여 주는 태그로 대신함")
    for t in candidates:
        src = shown[t]
        mark = "" if any(s.startswith(("블록", "빈칸")) for s in src) else "  <- 인라인만(본문 설명인지, JS 조각 같은 잡음인지 확인)"
        print(f"  {t:<32} {', '.join(dict.fromkeys(src))}{mark}")
    if later:
        print("  뒤 레슨이 소개하는 태그를 씀(여기서 소개할지, 예제를 고칠지): "
              + ", ".join(f"{t}({first[t]})" for t in later))
    if already:
        print("  앞 레슨이 이미 소개함: " + ", ".join(f"{t}({first[t]})" for t in already))
    print("  설명 없이 쓰기만 한 것은 빼고, 본문 문장으로만 소개한 것은 더할 것.")
    print('"introduces": ' + json.dumps(candidates, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------- CLI

class Report:
    """verify_content.Report와 같은 모양(이 파일을 단독으로 돌릴 때)."""

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


def main(argv=None):
    ap = argparse.ArgumentParser(description="선행 지식 검사(코드를 실행하지 않고 파싱만 함)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="지역 1~N 전체 검사")
    c.add_argument("-v", "--verbose", action="store_true", help="학습 시점, 예외가 막은 위반, 파싱 실패 블록도 출력")
    c.add_argument("--regions", default=REGIONS, help="지역 폴더들이 있는 곳(기본: content/regions)")
    d = sub.add_parser("draft", help="레슨 폴더 하나의 introduces 후보")
    d.add_argument("lesson", help="레슨 폴더(예: content/regions/r03-goblin-cave/lessons/L3-1)")
    for p in (c, d):
        p.add_argument("--introduces-file", metavar="JSON",
                       help="{레슨 ID: [태그]}로 lesson.json의 introduces를 덮어씀(introduces를 채우기 전 콘텐츠와 비교할 때)")
    args = ap.parse_args(argv)
    override = None
    if args.introduces_file:
        with open(args.introduces_file, encoding="utf-8") as f:
            override = json.load(f)
    if args.cmd == "draft":
        return draft(args.lesson, override)
    t0 = time.time()
    rep = Report(args.verbose)
    check_all(rep, os.path.abspath(args.regions), override)
    print(f"{time.time() - t0:.2f}초")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
