// npm run verify: 콘텐츠·샘플·맵·아트 검사를 차례로 돌린다.
// Windows와 Linux 모두에서 같은 CPython(3.11 이상)을 찾아 UTF-8 모드로 실행한다. 같은 규칙이 tests/cpython.ts에도 있다.
// 순서: PYRPG_CPYTHON → python3 → python. Windows의 python3는 Microsoft Store 안내 스텁일 수 있어서 실제로 실행해 본다.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };

function findCPython() {
  for (const cmd of [process.env.PYRPG_CPYTHON, "python3", "python"]) {
    if (!cmd) continue;
    const r = spawnSync(cmd, ["-c", "import sys; print(sys.version_info >= (3, 11))"], { encoding: "utf-8", env });
    if (r.status === 0 && r.stdout.trim() === "True") return cmd;
  }
  return undefined;
}

const py = findCPython();
if (!py) {
  console.error("Python 3.11 이상을 찾지 못했습니다. 설치하거나 PYRPG_CPYTHON에 경로를 지정하세요.");
  process.exit(1);
}

const maps = readdirSync("tools/maps")
  .filter((f) => /^build_r\d+\.py$/.test(f))
  .sort()
  .map((f) => [`tools/maps/${f}`, "--check"]);
const steps = [["tools/verify_content.py"], ["tools/verify_samples.py"], ...maps, ["tools/art/check.py"]];

for (const args of steps) {
  console.log(`\n$ ${py} ${args.join(" ")}`);
  const r = spawnSync(py, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
