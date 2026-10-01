// DOM UI E2E(dev/ui.html + 가짜 실행기). PW_PORT=4176 npx playwright test tests/e2e/ui.spec.ts
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Win = any;

async function boot(page: Page, speed = 0) {
  await page.setViewportSize({ width: 1300, height: 800 });
  await page.goto(`/dev/ui.html?speed=${speed}`);
  await page.waitForFunction(() => (window as Win).__uiReady === true);
}

async function typeInEditor(page: Page, text: string, selectAll = true) {
  await page.locator(".battle-editor .cm-content").click();
  if (selectAll) await page.keyboard.press("Control+A");
  await page.keyboard.type(text);
}

const SOLUTION_P0101 = "a, b = map(int, input().split())\nprint(a + b)";

test.describe("dialogue", () => {
  test("advances line by line and substitutes names", async ({ page }) => {
    await boot(page, 40);
    const done = page.evaluate(() => (window as Win).__ui.dialogue());
    const box = page.locator(".dlg-box");
    const text = page.locator(".dlg-text");
    await expect(box).toHaveAttribute("data-line", "0");
    await expect(box).toHaveClass(/has-portrait/);
    await expect(page.locator(".dlg-name")).toHaveText("누리");
    // 첫 입력은 줄을 끝까지 보여 준다
    await page.keyboard.press("Space");
    await expect(text).toHaveText("…깨어났어? 나는 누리! 지도 제작자야.");
    await expect(box).toHaveAttribute("data-line", "0");
    // IME 조합 중 Enter는 무시
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true })));
    await expect(box).toHaveAttribute("data-line", "0");

    await page.keyboard.press("Enter");
    await expect(box).toHaveAttribute("data-line", "1");
    await expect(page.locator(".dlg-name")).toHaveText("하늘");
    await expect(box).not.toHaveClass(/has-portrait/);
    await page.keyboard.press("z");
    await page.keyboard.press("z");
    await expect(box).toHaveAttribute("data-line", "2");
    await page.keyboard.press("Space");
    await expect(text).toContainText("반가워, 하늘!");
    await expect(text.locator("code")).toHaveText("print");
    await expect(box).toHaveClass(/has-portrait/);
    await expect(page.locator(".portrait")).toHaveAttribute("data-emotion", "happy");
    // 클릭으로도 넘어간다
    await page.locator(".dlg-modal").click();
    await expect(box).toHaveAttribute("data-line", "3");
    await page.locator(".dlg-modal").click();
    await expect(page.locator(".dlg-name")).toHaveText("상인");
    await expect(box).toHaveAttribute("data-speaker", "npc");
    await page.locator(".dlg-modal").click();
    await expect(box).toHaveAttribute("data-speaker", "system");
    await expect(page.locator(".dlg-name")).toBeHidden();
    await page.locator(".dlg-modal").click();
    await page.locator(".dlg-modal").click();
    await done;
    await expect(page.locator(".dlg-modal")).toHaveCount(0);
  });
});

test.describe("lesson", () => {
  test("runs an example and completes via the blank exercise", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.lesson());
    await expect(page.locator(".lesson-title")).toHaveText("변환의 주문");
    await expect(page.locator(".md-compare-title")).toHaveText("JavaScript와 비교");
    await expect(page.locator(".lesson-body")).toContainText("돌려줘, 하늘.");
    await page.locator(".md-run-btn").click();
    await expect(page.locator(".md-run-out")).toHaveText("7\n34");

    const claim = page.locator(".lesson-claim");
    await expect(claim).toBeDisabled();
    const input = page.locator(".blank-input");
    const fb = page.locator(".exercise .nuri-msg");
    for (const wrong of ["str", "float", "foo"]) {
      await input.fill(wrong);
      await page.locator(".blank-run").click();
      await expect(page.locator(".exercise .nuri-row")).toHaveAttribute("data-emotion", "worried");
    }
    await expect(fb).toContainText("NameError");
    await expect(page.locator(".blank-answer")).toHaveText("int");
    await input.fill("int");
    await input.press("Enter");
    await expect(page.locator(".exercise .nuri-row")).toHaveAttribute("data-emotion", "happy");
    await expect(page.locator(".blank-out")).toHaveText("7");
    await expect(claim).toBeEnabled();
    await claim.click();
    await expect(page.locator(".scroll-acquired")).toContainText("주문서 획득!");
    await expect(page.locator(".scroll-name")).toHaveText("변환의 주문서");
    await page.locator(".scroll-ok").click();
    expect(await done).toEqual({ completed: true });
    // 실행된 코드는 빈칸을 채운 코드
    const calls = await page.evaluate(() => (window as Win).__ui.fake.calls.filter((c: any) => c.method === "run").map((c: any) => c.code));
    expect(calls.at(-1)).toBe("a, b = map(int, input().split())\nprint(a + b)");
  });

  test("close button resolves completed=false", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.lesson());
    await page.locator(".lesson-close").click();
    expect(await done).toEqual({ completed: false });
    await expect(page.locator(".lesson-modal")).toHaveCount(0);
  });

  test("codex lists lessons and runs examples", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.codex());
    await expect(page.locator(".codex-item")).toHaveCount(2);
    await page.locator('.codex-item[data-lesson="L1-2"]').click();
    await expect(page.locator(".codex-lesson-title")).toHaveText("변환의 주문");
    await expect(page.locator(".codex-detail .exercise")).toHaveCount(0);
    await page.locator(".codex-detail .md-run-btn").click();
    await expect(page.locator(".codex-detail .md-run-out")).toHaveText("7\n34");
    await page.keyboard.press("Escape");
    await done;
    await expect(page.locator(".codex-modal")).toHaveCount(0);
  });
});

test.describe("battle", () => {
  test("editor: 4-space auto indent, exact text, keys isolated from the game", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      (window as Win).__gameKeys = 0;
      window.addEventListener("keydown", () => (window as Win).__gameKeys++);
    });
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101"));
    await expect(page.locator(".editor-hint")).toContainText("Esc 다음 Tab");
    await page.locator(".battle-editor .cm-content").click();
    await page.keyboard.type("def f(a, b):");
    await page.keyboard.press("Enter");
    await page.keyboard.type("return a + b");
    expect(await page.evaluate(() => (window as Win).__gameKeys)).toBe(0);
    // Tab은 들여쓰기
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.type("x");
    await page.keyboard.press("Home");
    await page.keyboard.press("Tab");
    await page.locator(".act-retreat").click();
    const out = await done;
    expect(out.finalCode).toBe("def f(a, b):\n    return a + b\n\n    x");
    expect(out.result).toBe("retreat");
    expect(out.attempts).toBe(0);
  });

  test("public run shows example results", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101"));
    await expect(page.locator(".enemy-seg")).toHaveCount(5);
    await expect(page.locator(".enemy-hidden")).toHaveText("(숨겨진 테스트 4개)");
    await expect(page.locator(".battle-statement-view table")).toContainText("1 2");
    await expect(page.locator(".battle-examples")).toHaveCount(0);
    await typeInEditor(page, "a, b = input().split()\nprint(a + b)");
    await page.locator(".act-public").click();
    const details = page.locator(".battle-msg-details");
    await expect(details).toContainText("예제 0/1 통과");
    await expect(details.locator(".fb-expected .fb-val")).toHaveText("3");
    await expect(details.locator(".fb-actual .fb-val")).toHaveText("12");
    await expect(page.locator(".battle-msg-text")).toContainText("이어 붙이기");
    await typeInEditor(page, SOLUTION_P0101);
    await page.locator(".act-public").click();
    await expect(details).toContainText("예제 1/1 통과");
    await expect(page.locator(".player-hp-text")).toHaveText("100/100");
    await page.locator(".act-retreat").click();
    expect((await done).attempts).toBe(0);
    const scopes = await page.evaluate(() => (window as Win).__ui.fake.calls.map((c: any) => c.scope));
    expect(scopes).toEqual(["public", "public"]);
  });

  test("failing casts deal attack × (1 − pass ratio) and explain", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101", { hp: 100 }));
    await typeInEditor(page, "a, b = input().split()\nprint(a + b)");
    // 1/5 통과 → 20 × 4/5 = 16
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "WA", fail: [1, 2, 3, 4], actual: "12" }));
    await page.locator(".act-cast").click();
    await expect(page.locator(".player-hp-text")).toHaveText("84/100");
    await expect(page.locator(".battle-msg-text")).toContainText("이어 붙이기");
    await expect(page.locator(".battle-msg-text")).toContainText("HP −16");
    const details = page.locator(".battle-msg-details");
    await expect(details).toContainText("통과 1/5");
    // 지역 1: 숨김 테스트의 입력·기대·내 출력 모두 공개
    await expect(details.locator(".fb-test").first()).toContainText("#2 숨김");
    await expect(details.locator(".fb-input .fb-val").first()).toHaveText("0 0");
    await expect(details.locator(".fb-expected .fb-val").first()).toHaveText("0");

    // RE: 해설 + 줄 강조, 0/5 → 20
    await page.evaluate(() =>
      (window as Win).__ui.fake.queueJudge({
        verdict: "RE",
        error: { type: "TypeError", message: "unsupported operand", line: 2, traceback: "TypeError: unsupported operand" },
      }),
    );
    await page.locator(".act-cast").click();
    await expect(page.locator(".player-hp-text")).toHaveText("64/100");
    await expect(page.locator(".battle-msg-text")).toContainText("2번째 줄");
    await expect(page.locator(".battle-msg-text")).toContainText("자료형이 맞지 않는 연산을 했어.");
    await expect(page.locator(".cm-error-line")).toHaveCount(1);
    await expect(page.locator(".cm-error-line")).toHaveText("print(a + b)");

    // fatal: 특별 안내
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "RE", fatal: true, fail: [4] }));
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle-msg-text")).toContainText("재귀가 너무 깊으면");
    await expect(page.locator(".player-hp-text")).toHaveText("60/100");

    await page.locator(".act-retreat").click();
    const out = await done;
    expect(out).toMatchObject({ result: "retreat", attempts: 3, hpLeft: 60, maxHintLevel: 0, solutionViewed: false });
  });

  test("region 3+ shows only the first failed hidden input", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0103", { regionOrder: 3 }));
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "WA", fail: [3, 6], actual: "0" }));
    await page.locator(".act-cast").click();
    const details = page.locator(".battle-msg-details");
    await expect(details).toContainText("통과 5/7");
    await expect(details.locator(".fb-input .fb-val")).toHaveText("(1, 1000000000000000000)");
    await expect(details.locator(".fb-expected")).toHaveCount(0);
    await expect(details.locator(".fb-actual")).toHaveCount(0);
    // 30 × 2/7 = 8.57 → 9
    await expect(page.locator(".player-hp-text")).toHaveText("91/100");
    await page.locator(".act-retreat").click();
    await done;
  });

  test("AC resolves victory with outcome fields; drafts are saved", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101", { hp: 70 }));
    await typeInEditor(page, SOLUTION_P0101);
    await expect.poll(() => page.evaluate(() => (window as Win).__ui.drafts.at(-1))).toBe(SOLUTION_P0101);
    await page.locator(".act-cast").click();
    await expect(page.locator(".enemy-seg.is-gone")).toHaveCount(5);
    await expect(page.locator(".battle-banner")).toContainText("정화 완료!");
    await expect(page.locator(".act-cast")).toBeDisabled();
    await page.locator(".banner-ok").click();
    const out = await done;
    expect(out).toMatchObject({
      problemId: "P0101",
      result: "victory",
      attempts: 1,
      maxHintLevel: 0,
      solutionViewed: false,
      finalCode: SOLUTION_P0101,
      hpLeft: 70,
    });
    expect(out.elapsedMs).toBeGreaterThan(0);
    await expect(page.locator(".battle-modal")).toHaveCount(0);
  });

  test("hints show their cost before opening; level 1 is free", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101"));
    const h1 = page.locator(".act-hint-1");
    const h2 = page.locator(".act-hint-2");
    const h3 = page.locator(".act-hint-3");
    await expect(h1).toHaveText("힌트 1 (무료)");
    await expect(h2).toHaveText("힌트 2 (−25%)");
    await expect(h3).toHaveText("힌트 3 (−50%)");
    await expect(h2).toBeDisabled();
    await h1.click();
    await expect(page.locator(".confirm-modal")).toHaveCount(0);
    await expect(page.locator(".battle-msg-details")).toContainText("자료형을 확인해 보세요");
    await expect(h1).toHaveText("힌트 1 ✓");
    await h2.click();
    await expect(page.locator(".confirm-msg")).toContainText("보상 −25%, 그림자 몬스터 등록");
    await page.locator(".confirm-no").click();
    await expect(h2).toHaveText("힌트 2 (−25%)");
    await h2.click();
    await page.locator(".confirm-yes").click();
    await expect(page.locator(".battle-msg-details")).toContainText("int()");
    await expect(h3).toBeEnabled();
    await h3.click();
    await expect(page.locator(".confirm-msg")).toContainText("보상 −50%");
    await page.locator(".confirm-no").click();
    await page.locator(".act-retreat").click();
    expect((await done).maxHintLevel).toBe(2);
  });

  test("previously opened hint level carries over", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101", { hintLevel: 2 }));
    await expect(page.locator(".act-hint-2")).toHaveText("힌트 2 ✓");
    await page.locator(".act-hint-2").click();
    await expect(page.locator(".confirm-modal")).toHaveCount(0);
    await page.locator(".act-retreat").click();
    expect((await done).maxHintLevel).toBe(2);
  });

  test("knockout at HP 0; three knockouts unlock the solution book", async ({ page }) => {
    await boot(page);
    let done = page.evaluate(() => (window as Win).__ui.battle("P0101", { hp: 10, knockouts: 2 }));
    await expect(page.locator(".act-solution")).toBeDisabled();
    await expect(page.locator(".act-solution")).toHaveText("해설서 (2/3)");
    await typeInEditor(page, "print(0)");
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle-banner")).toContainText("쓰러졌다");
    await page.locator(".banner-ok").click();
    expect(await done).toMatchObject({ result: "knockout", hpLeft: 0, attempts: 1, finalCode: "print(0)" });

    done = page.evaluate(() => (window as Win).__ui.battle("P0101", { knockouts: 3 }));
    const btn = page.locator(".act-solution");
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(page.locator(".confirm-msg")).toContainText("보상이 0");
    await page.locator(".confirm-yes").click();
    await expect(page.locator(".solution-code")).toHaveText(SOLUTION_P0101);
    await expect(page.locator(".solution-explanation")).toContainText("크기 제한이 없으므로");
    await page.locator(".battle-tabs .tab").first().click();
    await expect(page.locator(".battle-statement-view")).toBeVisible();
    await page.locator(".act-retreat").click();
    expect(await done).toMatchObject({ result: "retreat", solutionViewed: true });
  });

  test("boss: phase 2 shows the time gauge and verdict-only feedback", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0105"));
    await expect(page.locator(".phase-label")).toHaveText("1페이즈 · 정확성");
    await expect(page.locator(".enemy-seg")).toHaveCount(3);
    await expect(page.locator(".time-gauge")).toBeHidden();
    await typeInEditor(page, "a, b = map(int, input().split())\nt = 0\nfor x in range(a, b + 1):\nt += x\n");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("print(t)");
    await page.locator(".act-cast").click();
    await expect(page.locator(".phase-label")).toHaveText("2페이즈 · 시간 결계");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".battle-msg-text")).toContainText("시간 결계를 펼쳤어");
    await expect(page.locator(".time-gauge")).toBeVisible();
    await expect(page.locator(".time-gauge-text")).toHaveText("—");
    await page.locator(".act-cast").click();
    await expect(page.locator(".time-gauge")).toHaveAttribute("data-percent", "100");
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".battle-msg-text")).toContainText("너무 느려요");
    const details = page.locator(".battle-msg-details");
    await expect(details).toContainText("시간 초과(TLE) · 통과 1/3");
    await expect(details.locator(".fb-test")).toHaveCount(0);
    // 40 × 2/3 = 26.67 → 27
    await expect(page.locator(".player-hp-text")).toHaveText("73/100");

    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "AC", timeMs: 300 }));
    await page.locator(".act-cast").click();
    await expect(page.locator(".time-gauge")).toHaveAttribute("data-percent", "15");
    await page.locator(".banner-ok").click();
    const out = await done;
    expect(out).toMatchObject({ result: "victory", attempts: 3 });
    const phases = await page.evaluate(() => (window as Win).__ui.fake.calls.map((c: any) => `${c.scope}:${c.phase}`));
    expect(phases).toEqual(["all:1", "all:2", "all:2"]);
  });

  test("practice suggestion after estimatedMinutes × 2 (min 10)", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101"));
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await page.clock.fastForward("09:00");
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await page.clock.fastForward("01:01");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-practice", "true");
    await expect(page.locator(".battle-msg-text")).toContainText("연습 전투");
    await page.locator(".act-retreat").click();
    const out = await done;
    expect(out.elapsedMs).toBeGreaterThanOrEqual(600_000);
  });
});

test.describe("hud, menu, reward", () => {
  test("hud shows the week counter and toasts", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => (window as Win).__ui.hud({ weekDays: 5 }));
    await expect(page.locator(".hud-week")).toHaveText("이번 주 5/7");
    await expect(page.locator(".hud-level")).toHaveText("Lv 3");
    await expect(page.locator(".hud-hp-text")).toHaveText("82/100");
    await page.evaluate(() => (window as Win).__ui.toast("저장했어!"));
    await expect(page.locator(".toast")).toHaveText("저장했어!");
  });

  test("menu buttons fire their actions", async ({ page }) => {
    await boot(page);
    let done = page.evaluate(() => (window as Win).__ui.menu());
    await page.locator(".menu-export").click();
    await expect(page.locator(".menu-status")).toHaveText("저장 파일을 내보냈어.");
    await page.locator(".menu-codex").click();
    await expect(page.locator(".codex-modal")).toBeVisible();
    await page.locator(".codex-close").click();
    await expect(page.locator(".codex-modal")).toHaveCount(0);
    await page.locator(".menu-file").setInputFiles({ name: "save.json", mimeType: "application/json", buffer: Buffer.from("{}") });
    await done;
    await expect(page.locator(".menu-modal")).toHaveCount(0);

    done = page.evaluate(() => (window as Win).__ui.menu());
    await page.locator(".menu-reset").click();
    await page.locator(".confirm-no").click();
    await page.locator(".menu-reset").click();
    await page.locator(".confirm-yes").click();
    await done;

    done = page.evaluate(() => (window as Win).__ui.menu());
    await page.locator(".menu-close").click();
    await done;
    const calls = await page.evaluate(() => (window as Win).__ui.menuCalls);
    expect(calls).toEqual(["export", "codex", "import:save.json", "reset"]);
  });

  test("reward summary", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.reward());
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+75 XP");
    await expect(page.locator(".reward-penalty .reward-value")).toHaveText("보상 −25%");
    await expect(page.locator(".reward-levelup")).toContainText("Lv 1 → Lv 2");
    await expect(page.locator(".reward-shadow")).toBeVisible();
    await expect(page.locator(".reward-streak")).toBeVisible();
    await page.locator(".reward-ok").click();
    await done;
  });

  test("recommended: programmers link, BOJ disabled unless base url", async ({ page }) => {
    await boot(page);
    let done = page.evaluate(() => (window as Win).__ui.recommended(null));
    const items = page.locator(".recommend-item");
    await expect(items.first()).toHaveAttribute("data-site", "programmers");
    const link = page.locator('.recommend-item[data-id="120802"] a');
    await expect(link).toHaveAttribute("href", "https://school.programmers.co.kr/learn/courses/30/lessons/120802");
    await expect(link).toHaveAttribute("target", "_blank");
    const boj = page.locator('.recommend-item[data-id="1000"]');
    await expect(boj.locator("a")).toHaveCount(0);
    await expect(boj.locator(".is-disabled")).toHaveAttribute("aria-disabled", "true");
    await expect(boj).toContainText("1000번 A+B");
    await expect(page.locator(".recommend-note")).toHaveText("백준 재개 전까지 링크 비활성");
    await page.locator(".reward-ok").click();
    await done;

    done = page.evaluate(() => (window as Win).__ui.recommended("https://boj.example/problem"));
    await expect(page.locator('.recommend-item[data-id="1000"] a')).toHaveAttribute("href", "https://boj.example/problem/1000");
    await expect(page.locator(".recommend-note")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await done;
  });
});
