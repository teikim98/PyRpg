// Markdown을 그리고 ```python run 블록에 [실행] 버튼과 출력 창을 붙인다.
import type { PythonRunner } from "../contracts/runner";
import { formatRunOutput } from "./battleLogic";
import { h } from "./dom";
import { createCodeEditor, type CodeEditor } from "./editor";
import { renderMarkdown } from "./markdown";

export async function ensureRunner(runner: PythonRunner): Promise<void> {
  if (!runner.isReady()) await runner.init();
}

export interface MountedMarkdown {
  dispose(): void;
}

export function mountMarkdown(container: HTMLElement, md: string, runner: PythonRunner | null): MountedMarkdown {
  container.classList.add("md");
  container.innerHTML = renderMarkdown(md);
  const editors: CodeEditor[] = [];
  container.querySelectorAll<HTMLElement>(".md-run").forEach((block) => {
    const code = (block.querySelector("code")?.textContent ?? "").replace(/\n$/, "");
    if (!runner) return;
    const editor = createCodeEditor(code, { label: "예제 코드", className: "md-run-editor" });
    editors.push(editor);
    const out = h("pre", { class: "md-run-out", "aria-live": "polite", hidden: true });
    const needsStdin = /input\s*\(|stdin/.test(code);
    const stdin = needsStdin
      ? h("textarea", { class: "md-run-stdin", rows: "2", placeholder: "입력값(stdin)", "aria-label": "예제 입력값", spellcheck: "false" })
      : null;
    const btn = h("button", { class: "btn btn-small md-run-btn", type: "button" }, "실행");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      out.hidden = false;
      out.classList.remove("is-error");
      out.textContent = runner.isReady() ? "실행 중…" : "실행기를 깨우는 중…";
      try {
        await ensureRunner(runner);
        out.textContent = "실행 중…";
        const res = await runner.run({ code: editor.getCode(), stdin: stdin?.value ?? "" });
        out.textContent = formatRunOutput(res);
        out.classList.toggle("is-error", !!res.error || res.timedOut || res.fatal);
      } catch (e) {
        out.textContent = `실행하지 못했어: ${(e as Error).message}`;
        out.classList.add("is-error");
      } finally {
        btn.disabled = false;
      }
    });
    block.querySelector("pre")?.replaceWith(editor.wrapper);
    block.append(h("div", { class: "md-run-bar" }, btn, stdin), out);
  });
  return { dispose: () => editors.forEach((e) => e.destroy()) };
}
