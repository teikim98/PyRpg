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

const count = (text: string | null, needle: string) => (text ?? "").split(needle).length - 1;

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

test.describe("dialogue: 한글 입력 상태", () => {
  test("Z가 ㅋ로 들어와도(e.code = KeyZ) 대사가 넘어가고, 조합 중 입력은 무시", async ({ page }) => {
    await boot(page, 0);
    const done = page.evaluate(() => (window as Win).__ui.dialogue());
    const box = page.locator(".dlg-box");
    await expect(box).toHaveAttribute("data-line", "0");
    const key = (init: { key: string; code: string; isComposing?: boolean }) =>
      page.evaluate((i: any) => window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...i })), init as any);
    await key({ key: "ㅋ", code: "KeyZ" });
    await expect(box).toHaveAttribute("data-line", "1");
    await key({ key: "ㅋ", code: "KeyZ", isComposing: true });
    await expect(box).toHaveAttribute("data-line", "1");
    await key({ key: "ㅌ", code: "KeyX" });
    await expect(box).toHaveAttribute("data-line", "1");
    for (let i = 0; i < 10 && (await page.locator(".dlg-modal").count()); i++) await key({ key: "ㅋ", code: "KeyZ" });
    await done;
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

  test("Enter while a blank run is in flight does not run twice", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.lesson());
    await page.evaluate(() => ((window as Win).__ui.fake.stepMs = 300));
    const input = page.locator(".blank-input");
    await input.fill("str");
    await input.press("Enter");
    await input.press("Enter");
    await input.press("Enter");
    await expect(page.locator(".exercise .nuri-row")).toHaveAttribute("data-emotion", "worried");
    await page.waitForTimeout(800);
    const runs = await page.evaluate(() => (window as Win).__ui.fake.calls.filter((c: any) => c.method === "run").length);
    expect(runs).toBe(1);
    // 한 번 틀린 것으로만 센다(3번째 시도에 정답 공개)
    await expect(page.locator(".exercise .nuri-msg")).toContainText("1/3");
    await expect(page.locator(".blank-answer")).toHaveCount(0);
    await page.locator(".lesson-close").click();
    expect(await done).toEqual({ completed: false });
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

  test("onVictory fires at the AC moment, before the banner is clicked", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101"));
    await typeInEditor(page, SOLUTION_P0101);
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle-banner")).toContainText("정화 완료!");
    const early = await page.evaluate(() => (window as Win).__ui.victories);
    expect(early).toHaveLength(1);
    expect(early[0]).toMatchObject({ problemId: "P0101", result: "victory", attempts: 1, finalCode: SOLUTION_P0101 });
    await page.locator(".banner-ok").click();
    expect((await done).result).toBe("victory");
    expect(await page.evaluate(() => (window as Win).__ui.victories.length)).toBe(1);
  });

  test("function problem: [예제 실행] shows the user's print output", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0103"));
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "AC", stdout: "hp=10 atk=3\n" }));
    await page.locator(".act-public").click();
    const details = page.locator(".battle-msg-details");
    await expect(details).toContainText("예제 2/2 통과");
    await expect(details.locator(".fb-stdout .fb-label").first()).toHaveText("print 출력");
    await expect(details.locator(".fb-stdout .fb-val").first()).toHaveText("hp=10 atk=3");
    await page.locator(".act-retreat").click();
    await done;
  });

  test("companionLines: fatal_recursion and practice_suggest come from the common dialogues", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    const lines = {
      fatalRecursion: [
        { speaker: "companion", emotion: "surprised", text: "룬 엔진이 꺼졌다 켜졌어!" },
        { speaker: "companion", emotion: "neutral", text: "{player}, 재귀를 반복문으로 바꿔 볼래?" },
      ],
      practiceSuggest: [{ speaker: "companion", emotion: "worried", text: "전에 이긴 **{target}** 변형으로 연습할 수 있어, {player}!" }],
    };
    const done = page.evaluate((cl) => (window as Win).__ui.battle("P0101", { companionLines: cl, practiceOffer: { kind: "variant", sourceId: "P0103" } }), lines);
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "RE", fatal: true, fail: [4] }));
    await page.locator(".act-cast").click();
    const msg = page.locator(".battle-msg-text");
    await expect(msg).toContainText("룬 엔진이 꺼졌다 켜졌어!");
    await expect(msg).toContainText("하늘, 재귀를 반복문으로 바꿔 볼래?");
    await expect(msg).not.toContainText("재귀가 너무 깊으면");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-emotion", "surprised");
    await page.clock.fastForward("10:01");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-practice", "true");
    await expect(msg.locator(".practice-offer")).toHaveText("전에 이긴 철갑 두더지 변형으로 연습할 수 있어, 하늘!");
    await expect(msg.locator(".practice-offer strong")).toHaveText("철갑 두더지");
    // 지금 메시지(실행기 재시작 안내)는 지우지 않고 아래에 붙인다
    await expect(msg).toContainText("룬 엔진이 꺼졌다 켜졌어!");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-emotion", "worried");
    await page.locator(".act-retreat").click();
    await done;
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
    // 설명 먼저(단위 3-E4): 코드는 숨긴 채 시작하고 에디터는 가리지 않는다
    await expect(page.locator(".solution-explanation")).toContainText("크기 제한이 없으므로");
    await expect(page.locator(".solution-code")).toBeHidden();
    await expect(page.locator(".editor-cover")).toBeHidden();
    await page.locator(".solution-show-code").click();
    await expect(page.locator(".solution-code")).toHaveText(SOLUTION_P0101);
    await expect(page.locator(".editor-cover")).toBeVisible();
    await expect(page.locator(".act-cast")).toBeDisabled();
    await page.locator(".battle-tabs .tab").first().click();
    await expect(page.locator(".battle-statement-view")).toBeVisible();
    await expect(page.locator(".editor-cover")).toBeHidden();
    await expect(page.locator(".act-cast")).toBeEnabled();
    await page.locator(".act-retreat").click();
    expect(await done).toMatchObject({ result: "retreat", solutionViewed: true });
  });

  test("solution book hint route (unit 3-E4): boss phase pass is not a failure, fatal is; the time condition unlocks as the clock runs", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0105", { hintLevel: 3, hp: 300, maxHp: 300 }));
    const btn = page.locator(".act-solution");
    const castWith = async (spec: Record<string, unknown>) => {
      await page.evaluate((s) => (window as Win).__ui.fake.queueJudge(s), spec);
      await page.locator(".act-cast").click();
      await expect(page.locator(".battle")).not.toHaveClass(/is-busy/);
    };
    await expect(btn).toHaveText("해설서 (실패 0/2)");
    await expect(btn).toBeDisabled();
    // 보스 1페이즈 통과는 실패가 아니다
    await castWith({ verdict: "AC" });
    await expect(page.locator(".phase-label")).toContainText("2페이즈");
    await expect(btn).toHaveText("해설서 (실패 0/2)");
    await castWith({ verdict: "TLE" });
    await expect(btn).toHaveText("해설서 (실패 1/2)");
    // fatal(실행기 재시작)도 실패로 센다
    await castWith({ verdict: "RE", fatal: true });
    // P0105는 예상 15분 → 기준 시간 min(30, 20) = 20분
    await expect(btn).toHaveText("해설서 (시간 0/20분)");
    await expect(btn).toBeDisabled();
    await page.clock.fastForward("19:00");
    await expect(btn).toHaveText("해설서 (시간 19/20분)");
    await expect(btn).toBeDisabled();
    await expect(page.locator(".solution-unlock-note")).toHaveCount(0);
    await page.clock.fastForward("01:00");
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText("해설서");
    await expect(page.locator(".battle-msg .solution-unlock-note")).toContainText("해설서");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-solution-unlocked", "hint");
    await page.locator(".act-retreat").click();
    const out = await done;
    expect(out).toMatchObject({ result: "retreat", solutionViewed: false, maxHintLevel: 3 });
    expect(out.elapsedMs).toBeGreaterThanOrEqual(20 * 60_000);

    // 다음 전투: 힌트 경로는 전투마다 다시 판정한다(결정 23 P-E2). 누적 시간은 넘었어도 이번 전투의 실패가 0
    const again = page.evaluate((prior) => (window as Win).__ui.battle("P0105", { hintLevel: 3, priorElapsedMs: prior }), out.elapsedMs);
    await expect(btn).toHaveText("해설서 (실패 0/2)");
    await expect(btn).toBeDisabled();
    await page.locator(".act-retreat").click();
    await again;
  });

  test("solution book hint route (unit 3-E4): prior time + two failures after opening hint 3 in this battle", async ({ page }) => {
    await boot(page);
    const lines = [
      { speaker: "companion", emotion: "happy", text: "{player}, 힌트 경로로 해설서가 열렸어!" },
      { speaker: "companion", emotion: "neutral", text: "설명부터 읽어 봐." },
    ];
    const done = page.evaluate(
      (lines) => (window as Win).__ui.battle("P0101", { hintLevel: 2, knockouts: 2, priorElapsedMs: 10 * 60_000, companionLines: { solutionUnlockedHint: lines } }),
      lines,
    );
    const btn = page.locator(".act-solution");
    await expect(btn).toHaveText("해설서 (2/3)");
    // 힌트 3을 열기 전의 실패는 세지 않는다(결정 23 P-E3)
    await typeInEditor(page, "a, b = input().split()\nprint(a + b)");
    await page.locator(".act-cast").click();
    await expect(page.locator(".counter")).toBeVisible();
    await expect(page.locator(".battle")).not.toHaveClass(/is-busy/);
    await expect(btn).toHaveText("해설서 (2/3)");
    await page.locator(".act-hint-3").click();
    await page.locator(".confirm-yes").click();
    await expect(btn).toHaveText("해설서 (실패 0/2)");
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle")).not.toHaveClass(/is-busy/);
    await expect(btn).toHaveText("해설서 (실패 1/2)");
    await expect(btn).toBeDisabled();
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle")).not.toHaveClass(/is-busy/);
    // 이전 전투 10분 + 실패 2번 → 바로 열림. 채점 결과(반격)는 지우지 않고 누리 대사를 아래에 붙인다
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText("해설서");
    await expect(page.locator(".battle-msg .counter")).toBeVisible();
    await expect(page.locator(".battle-msg .solution-unlock-note")).toContainText("하늘, 힌트 경로로 해설서가 열렸어!");
    await expect(page.locator(".battle-msg .solution-unlock-note .nuri-line")).toHaveCount(2);
    await btn.click();
    await page.locator(".confirm-yes").click();
    await expect(page.locator(".solution-explanation")).toBeVisible();
    await page.locator(".act-retreat").click();
    expect(await done).toMatchObject({ result: "retreat", solutionViewed: true, maxHintLevel: 3, attempts: 3 });
  });

  test("solution book (unit 3-E4): explanation first → code → editor covered → released by [코드 닫기] or the problem tab", async ({ page }) => {
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101", { knockouts: 3 }));
    await typeInEditor(page, "print(1)");
    await page.locator(".act-solution").click();
    await page.locator(".confirm-yes").click();
    // 제목 → 보상 0 안내 → 설명 → [모범답안 코드 보기], 코드는 숨긴 채 시작
    const order = await page.locator(".battle-solution-view").evaluate((el) => Array.from(el.children as HTMLCollectionOf<HTMLElement>, (c) => (c.hidden ? `(${c.className})` : c.className)));
    expect(order).toEqual(["battle-title", "solution-note", "md solution-explanation", "solution-code-note", "btn solution-show-code", "(solution-code-box)"]);
    await expect(page.locator(".solution-code")).toBeHidden();
    await expect(page.locator(".editor-cover")).toBeHidden();
    await expect(page.locator(".act-cast")).toBeEnabled();
    const inert = () => page.locator(".battle-editor").evaluate((el) => el.hasAttribute("inert"));

    await page.locator(".solution-show-code").click();
    await expect(page.locator(".solution-code")).toHaveText(SOLUTION_P0101);
    await expect(page.locator(".editor-cover")).toBeVisible();
    await expect(page.locator(".editor-cover")).toContainText("에디터를 가려 둘게");
    expect(await inert()).toBe(true);
    await expect(page.locator(".act-cast")).toBeDisabled();
    await expect(page.locator(".act-public")).toBeDisabled();
    await expect(page.locator(".custom-run")).toBeDisabled();
    // 코드는 복사할 수 없다(user-select: none, copy 이벤트 막기)
    expect(await page.locator(".solution-code").evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
    const prevented = await page.locator(".solution-code").evaluate((el) => {
      const e = new Event("copy", { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(true);

    // [코드 닫기]로 해제
    await page.locator(".solution-hide-code").click();
    await expect(page.locator(".editor-cover")).toBeHidden();
    await expect(page.locator(".solution-code")).toBeHidden();
    await expect(page.locator(".solution-show-code")).toBeVisible();
    expect(await inert()).toBe(false);
    await expect(page.locator(".act-cast")).toBeEnabled();

    // 다시 보고 [문제] 탭으로 해제 → 바로 입력할 수 있다
    await page.locator(".solution-show-code").click();
    await expect(page.locator(".editor-cover")).toBeVisible();
    await page.locator(".battle-tabs .tab").first().click();
    await expect(page.locator(".battle-statement-view")).toBeVisible();
    await expect(page.locator(".editor-cover")).toBeHidden();
    expect(await inert()).toBe(false);
    // 해설서 탭으로 돌아가면 설명부터(코드는 닫혀 있다)
    await page.locator(".battle-tabs .tab").nth(1).click();
    await expect(page.locator(".solution-code")).toBeHidden();
    await page.locator(".battle-tabs .tab").first().click();
    await typeInEditor(page, SOLUTION_P0101);
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle-banner")).toContainText("정화");
    await page.locator(".banner-ok").click();
    expect(await done).toMatchObject({ result: "victory", solutionViewed: true });
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

  test("practice suggestion (unit 3-E3): at the reference time T = min(max(est × 2, 10), 20) of cumulative time, then [연습 전투] retreats into practice", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101", { practiceOffer: { kind: "variant", sourceId: "P0103" } }));
    const practiceBtn = page.locator(".act-practice");
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await expect(practiceBtn).toBeHidden();
    await page.clock.fastForward("09:00");
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await page.clock.fastForward("01:01");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-practice", "true");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-practice-kind", "variant");
    await expect(page.locator(".battle-msg-text .practice-offer")).toContainText("철갑 두더지");
    await expect(practiceBtn).toBeVisible();
    // 취소하면 그대로 전투
    await practiceBtn.click();
    await page.locator(".confirm-no").click();
    await expect(page.locator(".battle-modal")).toBeVisible();
    await practiceBtn.click();
    await expect(page.locator(".confirm-msg")).toContainText("후퇴로 처리");
    await page.locator(".confirm-yes").click();
    const out = await done;
    expect(out).toMatchObject({ result: "retreat", startPractice: true });
    expect(out.elapsedMs).toBeGreaterThanOrEqual(600_000);
  });

  test("practice suggestion (unit 3-E3): prior cumulative time counts, the cap is 20 minutes, and nothing without an offer", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    // P0105(예상 15분): 예전 기준(30분)이 아니라 상한 20분. 이전 전투들에서 19분을 썼으면 1분 뒤
    const done = page.evaluate(() => (window as Win).__ui.battle("P0105", { priorElapsedMs: 19 * 60_000, practiceOffer: { kind: "none" } }));
    await expect(page.locator(".battle-modal")).toBeVisible();
    await page.clock.fastForward("00:50");
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await page.clock.fastForward("00:15");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-practice-kind", "none");
    await expect(page.locator(".battle-msg-text .practice-offer")).toContainText("힌트 1");
    await expect(page.locator(".act-practice")).toBeHidden();
    await page.locator(".act-retreat").click();
    await done;
    // 앱이 상대를 넘기지 않으면(그림자전 등) 아무 말도 하지 않는다
    const none = page.evaluate(() => (window as Win).__ui.battle("P0101", { priorElapsedMs: 60 * 60_000 }));
    await page.clock.fastForward("00:05");
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await page.locator(".act-retreat").click();
    await none;
  });

  test("practice suggestion (unit 3-E3): right after the start when this problem has knocked us out; monster and warmup kinds", async ({ page }) => {
    await boot(page);
    const lines = {
      practiceSuggestMonster: [{ speaker: "companion", emotion: "worried", text: "연습 몬스터 **{target}**, 지금 걸어서 갈 수 있어." }],
      practiceSuggestWarmup: [{ speaker: "companion", emotion: "neutral", text: "최근에 이긴 **{target}** 몸풀기. 이 버그와는 개념이 달라." }],
      practiceSuggestApplied: [{ speaker: "companion", emotion: "neutral", text: "최근에 이긴 **{target}** 몸풀기 어때?" }],
    };
    // ② 연습 몬스터: 이름만, 버튼 없음. 시작 대사는 그대로 두고 아래에 붙인다
    let done = page.evaluate((cl) => (window as Win).__ui.battle("P0101", { knockouts: 1, companionLines: cl, practiceOffer: { kind: "monster", sourceId: "P0103", name: "졸린 책벌레" } }), lines);
    const msg = page.locator(".battle-msg-text");
    await expect(msg).toContainText("길을 막고 있어!");
    await expect(msg.locator(".practice-offer")).toHaveText("연습 몬스터 졸린 책벌레, 지금 걸어서 갈 수 있어.");
    await expect(page.locator(".battle-msg")).toHaveAttribute("data-practice-kind", "monster");
    await expect(page.locator(".act-practice")).toBeHidden();
    await page.locator(".act-retreat").click();
    await done;
    // ③ 몸풀기: 버튼 있음
    done = page.evaluate((cl) => (window as Win).__ui.battle("P0101", { knockouts: 2, companionLines: cl, practiceOffer: { kind: "warmup", sourceId: "P0103" } }), lines);
    await expect(msg.locator(".practice-offer")).toContainText("철갑 두더지 몸풀기. 이 버그와는 개념이 달라.");
    await expect(page.locator(".act-practice")).toBeVisible();
    await page.locator(".act-retreat").click();
    expect((await done).startPractice).toBeUndefined();
    // 응용 전투의 몸풀기는 개념을 말하지 않는 대사
    done = page.evaluate((cl) => (window as Win).__ui.battle("P0101", { knockouts: 1, companionLines: cl, practiceOffer: { kind: "warmup", sourceId: "P0103", applied: true } }), lines);
    await expect(msg.locator(".practice-offer")).toHaveText("최근에 이긴 철갑 두더지 몸풀기 어때?");
    await page.locator(".act-retreat").click();
    await done;
  });

  test("practice suggestion (unit 3-E3): never in shadow battles or against a practice monster", async ({ page }) => {
    await boot(page);
    for (const o of [{ shadow: true }, { patch: { practice: true } }]) {
      const done = page.evaluate((o) => (window as Win).__ui.battle("P0101", { ...o, knockouts: 1, priorElapsedMs: 60 * 60_000, practiceOffer: { kind: "variant", sourceId: "P0103" } }), o);
      await expect(page.locator(".battle-modal")).toBeVisible();
      await page.waitForTimeout(1300);
      await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
      await expect(page.locator(".practice-offer")).toHaveCount(0);
      await expect(page.locator(".act-practice")).toBeHidden();
      await page.locator(".act-retreat").click();
      await done;
    }
  });

  test("practice battle mode (unit 3-E3): no counter-attack, no solution book or potions, free hints, no offer", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101", { practice: true, potions: 2, hp: 50, knockouts: 3, practiceOffer: { kind: "variant", sourceId: "P0103" } }));
    await expect(page.locator(".battle")).toHaveClass(/is-practice/);
    await expect(page.locator(".enemy-name")).toHaveText("타입 슬라임 (연습)");
    await expect(page.locator(".battle-msg-text")).toContainText("연습 전투야!");
    await expect(page.locator(".act-solution")).toBeHidden();
    await expect(page.locator(".act-potion")).toBeHidden();
    await expect(page.locator(".act-practice")).toBeHidden();
    // 힌트는 대가 없이, 확인창 없이
    await expect(page.locator(".act-hint-2")).toHaveText("힌트 2");
    await page.locator(".act-hint-1").click();
    await page.locator(".act-hint-2").click();
    await expect(page.locator(".confirm-yes")).toHaveCount(0);
    await expect(page.locator(".act-hint-2")).toHaveText("힌트 2 ✓");
    // 틀려도 반격 없음
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "WA", fail: [2] }));
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle-msg-text")).toContainText("반격은 없어");
    await expect(page.locator(".player-hp-text")).toHaveText("50/100");
    // 연습 제안도 없다(쓰러짐·시간 조건이 있어도)
    await page.clock.fastForward("30:00");
    await expect(page.locator(".battle-msg")).not.toHaveAttribute("data-practice", "true");
    await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "AC" }));
    await page.locator(".act-cast").click();
    await expect(page.locator(".battle-banner")).toContainText("연습 완료!");
    await expect(page.locator(".battle-banner")).toContainText("오늘 공부한 날로 인정");
    await page.locator(".banner-ok").click();
    const out = await done;
    expect(out).toMatchObject({ result: "victory", maxHintLevel: 2, hpLeft: 50 });
  });

  test("elapsed time (unit 3-E1): counts only while the tab is visible, reports progress when hidden", async ({ page }) => {
    await page.clock.install();
    await boot(page);
    const done = page.evaluate(() => (window as Win).__ui.battle("P0101"));
    await expect(page.locator(".battle-modal")).toBeVisible();
    await page.clock.fastForward("01:00");
    const setHidden = (hidden: boolean) =>
      page.evaluate((hidden) => {
        if (hidden) Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        else delete (document as any).visibilityState;
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    await setHidden(true);
    const hiddenAt = await page.evaluate(() => (window as Win).__ui.progresses.at(-1));
    expect(hiddenAt).toMatchObject({ attempts: 0, maxHintLevel: 0, solutionViewed: false, hp: 100 });
    expect(hiddenAt.elapsedMs).toBeGreaterThanOrEqual(60_000);
    expect(hiddenAt.elapsedMs).toBeLessThan(65_000);
    // 숨겨진 5분은 세지 않는다
    await page.clock.fastForward("05:00");
    await setHidden(false);
    await page.clock.fastForward("01:00");
    await page.locator(".act-retreat").click();
    const out = await done;
    expect(out.elapsedMs).toBeGreaterThanOrEqual(120_000);
    expect(out.elapsedMs).toBeLessThan(130_000);
    expect(Number.isInteger(out.elapsedMs)).toBe(true);
  });

  test("RE with a problem diagnosis: diagnosis is the main text, the generic explanation folds behind [자세히]", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const ui = (window as Win).__ui;
      ui.traceback.unshift({ exception: "AttributeError", pattern: "has no attribute 'length'", text: "`.length`는 JS 말투야. Python에서 길이는 `len(s)`처럼 함수로 구해." });
      ui.problems.PX_RE = {
        ...ui.problems.P0101,
        id: "PX_RE",
        diagnoses: [{ when: { exception: "AttributeError", messageMatches: "length" }, text: "`arr.length`는 JS 말투야. 리스트의 길이는 `len(arr)`로 구해." }],
      };
    });
    const done = page.evaluate(() => (window as Win).__ui.battle("PX_RE"));
    await typeInEditor(page, "arr = [1, 2]\nprint(arr.length)");
    const err = { type: "AttributeError", message: "'list' object has no attribute 'length'", line: 2, traceback: "AttributeError: 'list' object has no attribute 'length'" };
    await page.evaluate((e) => (window as Win).__ui.fake.queueJudge({ verdict: "RE", error: e }), err);
    await page.locator(".act-cast").click();
    const msg = page.locator(".battle-msg-text");
    // 머리 줄: 줄 번호와 예외 이름만(칩) + [자세히]
    await expect(msg.locator(".err-head")).toContainText("주문이 폭발했어!");
    await expect(msg.locator(".err-head .err-chip")).toHaveText("2번째 줄 · AttributeError");
    await expect(msg.locator(".diag")).toBeVisible();
    await expect(msg.locator(".diag")).toContainText("len(arr)");
    expect(await msg.innerText()).not.toContain("함수로 구해");
    await expect(msg.locator(".err-explain")).toBeHidden();
    const more = msg.locator(".err-more");
    await expect(more).toHaveText("자세히");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(msg.locator(".err-explain")).toBeVisible();
    await expect(msg.locator(".err-explain")).toContainText("함수로 구해");
    await expect(more).toHaveText("접기");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await more.click();
    await expect(msg.locator(".err-explain")).toBeHidden();
    expect(count(await msg.textContent(), "2번째 줄")).toBe(1);

    // 진단이 없는 RE는 예전처럼 해설을 그대로 보여 준다
    await page.evaluate(() =>
      (window as Win).__ui.fake.queueJudge({ verdict: "RE", error: { type: "TypeError", message: "unsupported operand", line: 1, traceback: "TypeError" } }),
    );
    await page.locator(".act-cast").click();
    await expect(msg).toContainText("1번째 줄에서 TypeError가 났어.");
    await expect(msg.locator(".err-head")).toHaveCount(0);
    await expect(msg.locator(".err-more")).toHaveCount(0);
    await page.locator(".act-retreat").click();
    await done;
  });

  for (const [w, hgt] of [
    [1280, 720],
    [1024, 640],
  ] as const) {
    test(`long boss TLE diagnosis scrolls with a 'more' indicator and never overlaps the buttons (${w}×${hgt})`, async ({ page }) => {
      await boot(page);
      await page.setViewportSize({ width: w, height: hgt });
      await page.evaluate(() => {
        // 실제 게임처럼 #game이 화면 전체를 채운다
        document.getElementById("tools")!.style.display = "none";
        Object.assign(document.getElementById("game")!.style, { position: "fixed", inset: "0", width: "auto", height: "auto", margin: "0" });
        const ui = (window as Win).__ui;
        const long =
          "주문은 맞았지만 너무 느려! 자리마다 `max(arr[:i + 1])`을 부르면 앞부분을 통째로 복사하고 다시 훑어서, 20만 개면 약 200억 번 일해. " +
          "바로 앞 자리까지의 최댓값 `best`를 들고 다니면서 `x > best`일 때만 바꿔 봐. 한 번 지나가면 끝나. " +
          "(결과를 문자열 `+=`로 이어 붙였다면 그것도 느려. 리스트에 담아 `print(*result)`로 한 번에!) 끝까지 읽었어!";
        ui.problems.PX_BOSS = { ...ui.problems.P0105, id: "PX_BOSS", diagnoses: [{ when: { verdict: "TLE" }, text: long }] };
      });
      const done = page.evaluate(() => (window as Win).__ui.battle("PX_BOSS", { regionOrder: 3 }));
      await page.evaluate(() => (window as Win).__ui.fake.queueJudge({ verdict: "AC" }));
      await page.locator(".act-cast").click();
      await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
      await page.evaluate(() =>
        (window as Win).__ui.fake.queueJudge({ verdict: "TLE", error: { type: "KeyboardInterrupt", message: "", line: 3, traceback: "KeyboardInterrupt" } }),
      );
      await page.locator(".act-cast").click();
      const msg = page.locator(".battle-msg-text");
      await expect(msg.locator(":scope > :first-child")).toHaveClass(/diag/);
      await expect(msg.locator(".err-head .err-line")).toHaveText("3번째 줄");
      await expect(msg.locator(".counter")).toBeAttached();
      await expect(page.locator(".battle")).not.toHaveClass(/is-busy/);

      const box = page.locator(".battle-msg");
      const geo = () =>
        page.evaluate(() => {
          const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
          const el = document.querySelector(".battle-msg") as HTMLElement;
          return {
            bottom: r(".battle-bottom").bottom,
            msgBottom: r(".battle-msg").bottom,
            actionsTop: r(".battle-actions").top,
            actionsBottom: r(".battle-actions").bottom,
            overflowY: getComputedStyle(el).overflowY,
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          };
        });
      const g = await geo();
      expect(g.overflowY).toBe("auto");
      expect(g.msgBottom).toBeLessThanOrEqual(g.bottom);
      expect(g.bottom).toBeLessThanOrEqual(g.actionsTop);
      expect(g.actionsBottom).toBeLessThanOrEqual(hgt);
      // 진단은 칸 맨 위에서 시작한다
      expect(g.scrollTop).toBe(0);
      const more = page.locator(".battle-msg-more");
      if (g.scrollHeight > g.clientHeight + 4) {
        // 넘치면 '더 있어' 표시 → 누르면 내려가고, 끝까지 가면 사라진다
        await expect(more).toBeVisible();
        await expect(page.locator(".battle-msg-wrap")).toHaveClass(/has-more/);
        await box.evaluate((el) => (el.scrollTop = el.scrollHeight));
        await expect(more).toBeHidden();
        await expect(msg).toContainText("끝까지 읽었어!");
      } else {
        await expect(more).toBeHidden();
      }
      // 새 메시지가 오면 맨 위로 돌아간다
      await page.locator(".act-hint-1").click();
      await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBe(0);
      await expect(more).toBeHidden();
      await page.locator(".act-retreat").click();
      await done;
    });
  }
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
