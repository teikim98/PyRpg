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
  cacheLoadedFiles();
}

/**
 * 처음 접속에서는 service worker가 페이지를 제어하기 전에 번들·폰트·이미지를 받으므로 캐시에 들어가지 않는다.
 * 이미 받은 파일 목록을 service worker에 넘겨 캐시하게 해서, 한 번 접속한 뒤에는 오프라인으로도 뜨게 한다.
 */
function cacheLoadedFiles(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.ready
    .then((reg) => {
      const urls = [location.href, ...performance.getEntriesByType("resource").map((e) => e.name)];
      reg.active?.postMessage({ type: "cache-urls", urls });
    })
    .catch(() => undefined);
}

// 오프라인 실행(design.md §12.3). 개발 서버에서는 캐시가 수정 반영을 방해하므로 등록하지 않는다
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => console.warn("service worker 등록 실패", e));
}

main().catch((e) => {
  console.error(e);
  const boot = document.getElementById("boot");
  if (boot) boot.textContent = `시작하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`;
});
