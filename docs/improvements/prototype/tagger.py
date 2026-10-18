"""선행 지식 검사 프로토타입의 태거(임시, 저장소에 넣지 않음).

code_features(code, modules) -> {tag: set(lineno)}
태그 형식은 docs/improvements/02-prerequisites.md §4.
"""
import ast
import builtins
import re

BUILTINS = set(dir(builtins))
OPS = {ast.FloorDiv: "//", ast.Mod: "%", ast.Pow: "**", ast.Div: "/", ast.BitAnd: "&", ast.BitOr: "|",
       ast.BitXor: "^", ast.LShift: "<<", ast.RShift: ">>"}
LOOPS = (ast.For, ast.While)


class Tagger(ast.NodeVisitor):
    def __init__(self, modules=()):
        self.tags = {}
        self.modules = {m: m for m in modules}  # alias -> module path
        self.from_names = {}                     # name -> "mod.name"
        self.loop_depth = 0
        self.func_stack = []
        self.defined_funcs = set()

    def add(self, tag, node):
        self.tags.setdefault(tag, set()).add(getattr(node, "lineno", 0))

    # ---- import
    def visit_Import(self, node):
        for a in node.names:
            self.add(f"import:{a.name}", node)
            self.modules[a.asname or a.name.split(".")[0]] = a.name if a.asname else a.name.split(".")[0]
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        mod = node.module or ""
        self.add(f"import:{mod}", node)
        for a in node.names:
            self.from_names[a.asname or a.name] = f"{mod}.{a.name}"
            self.add(f"api:{mod}.{a.name}", node)
        self.generic_visit(node)

    def _dotted(self, node):
        parts = []
        while isinstance(node, ast.Attribute):
            parts.append(node.attr)
            node = node.value
        if isinstance(node, ast.Name):
            parts.append(node.id)
            return list(reversed(parts))
        return None

    # ---- names / attributes
    def visit_Attribute(self, node):
        d = self._dotted(node)
        if d and d[0] in self.modules:
            self.add("api:" + ".".join([self.modules[d[0]]] + d[1:]), node)
            return  # 내부 Attribute를 다시 보지 않음
        if d and d[0] in self.from_names:
            self.add("api:" + ".".join([self.from_names[d[0]]] + d[1:]), node)
            return
        self.generic_visit(node)

    def visit_Name(self, node):
        if node.id in self.from_names and isinstance(node.ctx, ast.Load):
            self.add("api:" + self.from_names[node.id], node)

    def visit_Call(self, node):
        f = node.func
        if isinstance(f, ast.Name):
            if f.id in self.from_names:
                self.add("api:" + self.from_names[f.id], node)
            elif f.id in BUILTINS and f.id not in self.defined_funcs:
                self.add(f"call:{f.id}", node)
            if self.func_stack and f.id == self.func_stack[-1]:
                self.add("recursion", node)
        elif isinstance(f, ast.Attribute):
            d = self._dotted(f)
            if not (d and (d[0] in self.modules or d[0] in self.from_names)):
                self.add(f"method:{f.attr}", node)
        for a in node.args:
            if isinstance(a, ast.Starred):
                self.add("starred-call", a)
        user = isinstance(f, ast.Name) and f.id in self.defined_funcs
        for k in node.keywords:
            if k.arg is None:
                self.add("dstar-call", node)
            elif user:
                self.add("kwarg-user", k)
            else:
                self.add(f"kwarg:{k.arg}", k)
        self.generic_visit(node)

    # ---- functions
    def visit_FunctionDef(self, node):
        self.add("def", node)
        if self.func_stack:
            self.add("nested-def", node)
        if node.decorator_list:
            self.add("decorator", node)
        a = node.args
        if a.defaults or a.kw_defaults and any(x is not None for x in a.kw_defaults):
            self.add("def-default", node)
        if a.vararg or a.kwarg:
            self.add("def-star", node)
        self.defined_funcs.add(node.name)
        self.func_stack.append(node.name)
        saved = self.loop_depth
        self.loop_depth = 0
        self.generic_visit(node)
        self.loop_depth = saved
        self.func_stack.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Return(self, node):
        self.add("return", node)
        if isinstance(node.value, ast.Tuple):
            self.add("tuple-literal", node)
            for e in node.value.elts:
                self.visit(e)
            return
        self.generic_visit(node)

    def visit_Lambda(self, node):
        self.add("lambda", node)
        self.generic_visit(node)

    def visit_Global(self, node):
        self.add("global", node)

    def visit_Nonlocal(self, node):
        self.add("nonlocal", node)

    # ---- control flow
    def visit_If(self, node):
        self.add("if", node)
        if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If) and node.orelse[0].col_offset == node.col_offset:
            self.add("elif", node.orelse[0])
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
        self.add("try", node)
        self.generic_visit(node)

    visit_TryStar = visit_Try

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

    # ---- assignment
    def visit_Assign(self, node):
        for t in node.targets:
            if isinstance(t, (ast.Tuple, ast.List)):
                if any(isinstance(e, ast.Starred) for e in t.elts):
                    self.add("starred-assign", node)
                if isinstance(node.value, (ast.Tuple, ast.List)) and isinstance(t, ast.Tuple):
                    if any(isinstance(e, ast.Subscript) for e in t.elts):
                        self.add("subscript-unpack", node)
                    else:
                        self.add("tuple-assign", node)
                    for e in t.elts:
                        self.visit(e)
                    for e in node.value.elts:
                        self.visit(e)
                    continue
                self.add("unpack-assign", node)
            self.visit(t)
        if not any(isinstance(t, (ast.Tuple, ast.List)) and isinstance(node.value, (ast.Tuple, ast.List)) for t in node.targets):
            self.visit(node.value)

    def visit_AugAssign(self, node):
        self.add("augassign", node)
        if type(node.op) in OPS:
            self.add(f"op:{OPS[type(node.op)]}", node)
        self.generic_visit(node)

    def visit_Starred(self, node):
        self.generic_visit(node)

    # ---- expressions
    def visit_BinOp(self, node):
        if type(node.op) in OPS:
            self.add(f"op:{OPS[type(node.op)]}", node)
        if isinstance(node.op, ast.Mult) and (isinstance(node.left, ast.List) or isinstance(node.right, ast.List)):
            self.add("list-mult", node)
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        self.add("and" if isinstance(node.op, ast.And) else "or", node)
        self.generic_visit(node)

    def visit_UnaryOp(self, node):
        if isinstance(node.op, ast.Not):
            self.add("not", node)
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
            if isinstance(g.target, ast.Tuple):
                self.add("unpack-for", node)
        self.generic_visit(node)

    def visit_ListComp(self, node):
        self._comp(node, "listcomp")

    def visit_SetComp(self, node):
        self._comp(node, "setcomp")

    def visit_DictComp(self, node):
        self._comp(node, "dictcomp")

    def visit_GeneratorExp(self, node):
        self._comp(node, "genexp")


def code_features(code, modules=()):
    tree = ast.parse(code)
    # 함수 이름을 먼저 모아서 사용자 정의 함수 호출을 내장 함수로 오인하지 않게 한다
    t = Tagger(modules)
    t.defined_funcs = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    t.visit(tree)
    return t.tags


FENCE = re.compile(r"```python[^\n]*\n(.*?)```", re.S)
INLINE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")


def lesson_blocks(md):
    """(시작 줄, 코드) 목록. ```python 블록만(js 제외)."""
    out = []
    for m in FENCE.finditer(md):
        line = md.count("\n", 0, m.start(1)) + 1
        out.append((line, m.group(1)))
    return out


def inline_snippets(text):
    no_fence = re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    out = []
    for m in INLINE.finditer(no_fence):
        out.append((no_fence.count("\n", 0, m.start()) + 1, m.group(1)))
    return out


def safe_features(code, modules=()):
    code = re.sub(r"_{3,}", "BLANK", code)
    if code.startswith("."):
        code = "x" + code
    try:
        f = code_features(code, modules)
    except SyntaxError:
        return None
    # 빈칸 자리의 이름(BLANK, BLANK.xxx)은 버린다
    return {k: v for k, v in f.items() if "BLANK" not in k}
