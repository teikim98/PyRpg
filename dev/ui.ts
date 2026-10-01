// UI 개발 페이지 진입점. 실제 로직은 tests/fixtures/ui/harness.ts(타입 검사 대상)에 있다.
import { mountHarness } from "../tests/fixtures/ui/harness";

const api = mountHarness(document.getElementById("game")!);
const tools = document.getElementById("tools")!;
const buttons: [string, () => unknown][] = [
  ["대화", () => api.dialogue()],
  ["레슨 L1-2", () => api.lesson()],
  ["코덱스", () => api.codex()],
  ["전투 P0101", () => api.battle("P0101")],
  ["전투 P0103(지역 3 공개 수준)", () => api.battle("P0103", { regionOrder: 3 })],
  ["보스 P0105", () => api.battle("P0105")],
  ["전투(쓰러짐 3회)", () => api.battle("P0101", { knockouts: 3, hp: 30 })],
  ["HUD", () => api.hud()],
  ["토스트", () => api.toast("저장했어!")],
  ["메뉴", () => api.menu()],
  ["보상", () => api.reward()],
  ["실전 추천", () => api.recommended()],
];
for (const [label, fn] of buttons) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", () => void fn());
  tools.append(b);
}
(window as unknown as { __uiReady: boolean }).__uiReady = true;
