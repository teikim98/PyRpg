// 진입점: 모듈을 만들어 앱 계층에 넘긴다.
import { App } from "./app/app";
import { loadContent } from "./content/loader";
import { createWorld } from "./game";
import { createPythonRunner } from "./python/runner";
import { SaveStore, requestPersistence } from "./state";
import { createUi } from "./ui";

async function main(): Promise<void> {
  const appEl = document.getElementById("app")!;
  const gameEl = document.getElementById("game")!;
  const params = new URLSearchParams(location.search);
  const e2e = params.has("e2e");

  const content = loadContent();
  const ui = createUi(appEl, {
    companionPortrait: content.companion.portrait,
    // E2E에서는 타자기 효과를 끈다
    typeSpeedMs: e2e ? 0 : undefined,
  });
  const runner = createPythonRunner();
  const store = new SaveStore();
  void requestPersistence();

  const app = new App({ content, runner, ui, worldFactory: createWorld, store, bojBaseUrl: null });
  // 테스트 훅은 ?e2e일 때만 불러온다(design.md §12.3)
  const hook = e2e ? (await import("./app/e2e")).createE2eHook(app, { runner, content, ui, store }) : null;
  if (hook) Object.assign(window, { __pyrpg: hook });

  await app.start(gameEl);
  document.getElementById("boot")?.remove();
  if (hook) hook.ready = true;
}

main().catch((e) => {
  console.error(e);
  const boot = document.getElementById("boot");
  if (boot) boot.textContent = `시작하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`;
});
