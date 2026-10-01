// 진입점. Phase 2 통합 단계에서 src/app/의 앱 계층으로 교체한다.
const app = document.getElementById("app")!;
app.textContent = "PyRpg";
(window as unknown as { __pyrpg: unknown }).__pyrpg = { ready: true, crossOriginIsolated: self.crossOriginIsolated };
