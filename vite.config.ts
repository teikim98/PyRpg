import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
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

export default defineConfig({
  // assets/의 도트 아트·manifest는 경로 그대로 정적 제공(/sprites/player.png 등)
  publicDir: "assets",
  build: { rollupOptions: { input: { main: resolve("index.html"), ...devPages } } },
  optimizeDeps: { exclude: ["pyodide"] },
  worker: { format: "es" },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  plugins: [
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
