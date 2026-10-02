// 테스트가 쓰는 로컬 CPython(3.11 이상)을 찾는다. 같은 규칙이 tools/verify.mjs에도 있다.
// 순서: PYRPG_CPYTHON → 클라우드의 python3.14 → python3 → python.
// Windows의 python3는 Microsoft Store 안내 스텁일 수 있어서(실행하면 실패) 실제로 --version을 돌려 본다.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function findCPython(): string | undefined {
  const candidates = [
    process.env.PYRPG_CPYTHON,
    existsSync("/root/.local/bin/python3.14") ? "/root/.local/bin/python3.14" : undefined,
    "python3",
    "python",
  ];
  for (const cmd of candidates) {
    if (!cmd) continue;
    const r = spawnSync(cmd, ["-c", "import sys; print(sys.version_info >= (3, 11))"], { encoding: "utf-8" });
    if (r.status === 0 && r.stdout.trim() === "True") return cmd;
  }
  return undefined;
}

/** 찾은 CPython 명령(없으면 undefined) */
export const CPYTHON = findCPython();

/** 자식 Python의 입출력을 UTF-8로(Windows 기본 인코딩 cp949로 한글이 깨지지 않게) */
export const CPYTHON_ENV = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };
