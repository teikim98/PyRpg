import { createHash } from "node:crypto";
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// dev/*.html은 모듈별 개발·테스트용 페이지(E2E에서 사용). 빌드에도 포함한다.
const devPages = existsSync("dev")
  ? Object.fromEntries(readdirSync("dev").filter((f) => f.endsWith(".html")).map((f) => [`dev_${f.slice(0, -5)}`, resolve("dev", f)]))
  : {};

// SharedArrayBuffer(무한루프 소프트 중단, design.md §9.5)를 쓰려면 cross-origin isolated여야 한다.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

/** sw.js의 자리표시자. 빌드 때 이번 빌드의 ID로 바뀐다(캐시 이름이 빌드마다 달라져 옛 캐시를 지운다) */
const SW_BUILD_ID_PLACEHOLDER = "__PYRPG_BUILD_ID__";

/** 번들과 정적 파일(assets/) 내용의 해시를 빌드 ID로 dist/sw.js에 넣는다 */
function serviceWorkerBuildId(): Plugin {
  const hash = createHash("sha256");
  let outDir = "dist";
  const addDir = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) addDir(path);
      else hash.update(path).update(readFileSync(path));
    }
  };
  return {
    name: "pyrpg-sw-build-id",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_opts, bundle) {
      for (const name of Object.keys(bundle).sort()) {
        const chunk = bundle[name];
        hash.update(name).update(chunk.type === "chunk" ? chunk.code : chunk.source);
      }
    },
    closeBundle() {
      const sw = join(outDir, "sw.js");
      if (!existsSync(sw) || !readFileSync(sw, "utf8").includes(SW_BUILD_ID_PLACEHOLDER)) return;
      addDir(resolve("assets"));
      const id = hash.digest("hex").slice(0, 12);
      writeFileSync(sw, readFileSync(sw, "utf8").replaceAll(SW_BUILD_ID_PLACEHOLDER, id));
    },
  };
}

export default defineConfig({
  // assets/의 도트 아트·manifest는 경로 그대로 정적 제공(/sprites/player.png 등)
  publicDir: "assets",
  build: { rollupOptions: { input: { main: resolve("index.html"), ...devPages } } },
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  plugins: [
    serviceWorkerBuildId(),
    viteStaticCopy({
      targets: [
        {
          // Pyodide 코어만 복사한다(design.md §9.4). 파일 목록은 pyodide 버전을 올릴 때 확인한다.
          src: ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"].map(
            (f) => `node_modules/pyodide/${f}`,
          ),
          dest: "pyodide",
          rename: { stripBase: true },
        },
      ],
    }),
  ],
});
