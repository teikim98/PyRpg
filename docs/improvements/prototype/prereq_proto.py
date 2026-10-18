"""선행 지식 검사 프로토타입(임시, 저장소에 넣지 않음). 02-prerequisites.md §4 설계를 따른다.

1) introduces.json 생성: 레슨이 보여 주는 태그(코드 블록·미니 연습·본문 인라인 코드·summary) - 제외 목록
2) 레슨 코드 블록·미니 연습: 이전 레슨까지 + 자기 introduces 밖이면 오류
3) solution.py: 학습 시점 허용 목록 + starter.py 태그 밖이면 오류
4) 힌트 코드, 보스 slow.py: 경고
5) 정보: 레슨 예제와 같은 코드 조각(이름 무시, 노드 12개 이상), 소개했지만 어느 모범답안도 쓰지 않는 태그
"""
import ast
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tagger import lesson_blocks, inline_snippets, safe_features, code_features

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "content", "regions")
MODS = ("sys", "collections", "math", "functools", "itertools", "heapq", "bisect")

# 레슨 본문을 읽고 판단한 제외 목록: 예제에서 설명 없이 쓰기만 한 것(소개로 치지 않음)과 인라인 잡음(JS 코드 등)
NOT_INTRODUCED = {
    "L2-4": {"for-iter"},            # split() 조각 순회. 정식 설명은 L3-4
    "L3-5": {"tuple-assign"},        # n, m = 3, 4 를 설명 없이 씀. 맞바꾸기 설명은 L5-1
    "L4-1": {"try"},                 # "나중에 배워"라고 밝히고 에러 메시지 보기용으로만 씀
    "L5-1": {"def", "return", "try"},  # 여러 값 돌려주기 예제. def/return 설명은 L6-1. try는 에러 보기용
    "L5-2": {"try"}, "L5-3": {"try"}, "L5-4": {"try"}, "L5-5": {"try"}, "L6-3": {"try"}, "L6-4": {"try"},
}
NOISE = {
    "L1-3": {"method:floor"},        # JS Math.floor
    "L2-2": {"dict-literal"},        # 본문의 `{}`(중괄호 설명)
    "L3-3": {"method:push"},         # JS push
    "L4-2": {"method:toUpperCase", "method:메서드"},
    "L4-3": {"dict-literal"},        # 본문의 `{}`(f-string 중괄호 설명)
    "L6-1": {"kwarg:b"},
}
# 하나가 소개되면 함께 아는 것으로 보는 태그
IMPLIES = {"tuple-assign": {"subscript-unpack"}}


def rel(p):
    return os.path.relpath(p, ROOT).replace("\\", "/")


def lesson_tags(md, lj):
    """레슨이 보여 주는 모든 태그 → (위치 목록), 코드 블록 태그(검사 대상) 따로."""
    shown, blocks = {}, []
    for line, code in lesson_blocks(md):
        f = safe_features(code)
        if f is None:
            continue
        for t, ls in f.items():
            shown.setdefault(t, set())
        blocks.append((line, f))
    ex = lj.get("exercise") or {}
    if ex.get("code"):
        f = safe_features(ex["code"].replace("___", ex["answer"]))
        if f:
            for t in f:
                shown.setdefault(t, set())
            blocks.append(("미니 연습", f))
    for _, code in inline_snippets(md) + inline_snippets(lj["scroll"]["summary"]):
        f = safe_features(code, MODS)
        if f:
            for t in f:
                shown.setdefault(t, set())
    return set(shown), blocks


def expand(tags):
    out = set(tags)
    for t in tags:
        out |= IMPLIES.get(t, set())
    return out


def stmt_dumps(tree, min_nodes=12):
    """이름을 지운 문장 subtree dump → 노드 수."""
    out = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.stmt) and not isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef)):
            n = sum(1 for _ in ast.walk(node))
            if n < min_nodes:
                continue
            clone = ast.parse(ast.unparse(node)).body[0]
            for x in ast.walk(clone):
                if isinstance(x, ast.Name):
                    x.id = "_"
                elif isinstance(x, ast.arg):
                    x.arg = "_"
            out[ast.dump(clone)] = (n, node.lineno)
    return out


def main():
    t0 = time.time()
    regions = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)))
    order, intro, lesson_dir, scroll_of = [], {}, {}, {}
    lesson_blocks_by = {}
    for reg in regions:
        ld = os.path.join(ROOT, reg, "lessons")
        for lid in sorted(os.listdir(ld), key=lambda s: int(s.split("-")[1])):
            md = open(os.path.join(ld, lid, "lesson.md"), encoding="utf-8").read()
            lj = json.load(open(os.path.join(ld, lid, "lesson.json"), encoding="utf-8"))
            shown, blocks = lesson_tags(md, lj)
            intro[lid] = sorted(shown - NOT_INTRODUCED.get(lid, set()) - NOISE.get(lid, set()))
            order.append((reg, lid))
            lesson_dir[lid] = os.path.join(ld, lid)
            scroll_of[lj["scroll"]["id"]] = lid
            lesson_blocks_by[lid] = (md, blocks)
    # 같은 태그를 앞 레슨이 이미 소개했으면 뒤 레슨 목록에서는 뺀다(처음 소개한 레슨만 남김)
    first = {}
    for _, lid in order:
        for t in intro[lid]:
            first.setdefault(t, lid)
    introduces = {lid: [t for t in intro[lid] if first[t] == lid] for _, lid in order}
    json.dump(introduces, open("introduces.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    idx = {lid: i for i, (_, lid) in enumerate(order)}

    def known_upto(i):
        s = set()
        for _, lid in order[: i + 1]:
            s |= set(introduces[lid])
        return expand(s)

    results = []  # (region, level, kind, where, tags)

    # 2) 레슨 코드 블록
    for reg, lid in order:
        allowed = known_upto(idx[lid])
        md, blocks = lesson_blocks_by[lid]
        for line, f in blocks:
            bad = {t: ls for t, ls in f.items() if t not in allowed}
            if bad:
                where = f"{lid}/lesson.md:{line}" if line != "미니 연습" else f"{lid} 미니 연습"
                detail = ", ".join(f"{t}(→{first.get(t, '없음')})" for t in sorted(bad))
                results.append((reg, "오류", "레슨", where, detail))

    # 레슨 예제 subtree(복제 실험용): 지역 순서대로 누적
    lesson_dumps = {}
    for reg, lid in order:
        md, _ = lesson_blocks_by[lid]
        for line, code in lesson_blocks(md):
            try:
                tree = ast.parse(code)
            except SyntaxError:
                continue
            for d, (n, ln) in stmt_dumps(tree).items():
                lesson_dumps.setdefault(d, (lid, ln + line - 1, n))

    used_by_solutions = set()
    counts = {}
    for reg in regions:
        pdir = os.path.join(ROOT, reg, "problems")
        # 이 지역 첫 레슨의 앞까지 = 이전 지역 전부
        reg_lessons = [lid for r, lid in order if r == reg]
        for pid in sorted(os.listdir(pdir)):
            pf = os.path.join(pdir, pid)
            pj = json.load(open(os.path.join(pf, "problem.json"), encoding="utf-8"))
            req = [scroll_of[s] for s in pj.get("requires", []) if s in scroll_of]
            last = max((idx[l] for l in req), default=idx[reg_lessons[0]] - 1)
            point = order[last][1] if last >= 0 else "-"
            allowed = known_upto(last)
            starter_p = os.path.join(pf, "starter.py")
            starter = set()
            if os.path.exists(starter_p):
                try:
                    starter = set(code_features(open(starter_p, encoding="utf-8").read()))
                except SyntaxError:
                    pass
            allowed_p = allowed | expand(starter)
            sol_code = open(os.path.join(pf, "solution.py"), encoding="utf-8").read()
            sol = code_features(sol_code)
            used_by_solutions |= set(sol)
            mods = tuple(t.split(":", 1)[1] for t in sol if t.startswith("import:"))
            bad = {t: ls for t, ls in sol.items() if t not in allowed_p}
            tag = "보스" if pj.get("boss") else ("필수" if not pj.get("optional", False) else "선택")
            if bad:
                detail = ", ".join(f"{t}@{','.join(map(str, sorted(ls)))}(→{first.get(t, '없음')})" for t, ls in sorted(bad.items()))
                results.append((reg, "오류", "정답", f"{pid}/solution.py (학습 시점 {point})", detail))
            # 힌트
            for hi, h in enumerate(pj.get("hints", []), 1):
                text = h if isinstance(h, str) else h.get("text", "")
                snippets = [c for _, c in lesson_blocks(text)] + [c for _, c in inline_snippets(text)]
                badh = set()
                for c in snippets:
                    f = safe_features(c, mods + ("sys",) if "sys" in c else mods)
                    if f:
                        badh |= {t for t in f if t not in allowed_p}
                if badh:
                    results.append((reg, "경고", "힌트", f"{pid} 힌트 {hi}", ", ".join(f"{t}(→{first.get(t, '없음')})" for t in sorted(badh))))
            # 보스 비효율 답안
            slow_p = os.path.join(pf, "slow.py")
            if os.path.exists(slow_p):
                f = code_features(open(slow_p, encoding="utf-8").read())
                bads = {t: ls for t, ls in f.items() if t not in allowed_p}
                if bads:
                    results.append((reg, "경고", "비효율 답안", f"{pid}/slow.py", ", ".join(f"{t}@{','.join(map(str, sorted(ls)))}" for t, ls in sorted(bads.items()))))
            # 복제 실험
            for d, (n, ln) in stmt_dumps(ast.parse(sol_code)).items():
                if d in lesson_dumps:
                    lid, lln, _ = lesson_dumps[d]
                    if idx[lid] <= max(last, 0) or lid in reg_lessons:
                        results.append((reg, "정보", "복제", f"{pid}/solution.py:{ln}", f"{lid}/lesson.md:{lln} 와 같은 조각(노드 {n})"))
            counts[reg] = counts.get(reg, 0) + 1

    # 출력
    for r in results:
        print(" | ".join(r))
    print()
    orphan = sorted(t for t in first if t not in used_by_solutions)
    print("소개했지만 어느 모범답안도 쓰지 않는 태그:", " ".join(orphan))
    print("문제 수:", counts, "레슨 수:", len(order), f"시간 {time.time() - t0:.2f}초")
    json.dump(results, open("results.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
