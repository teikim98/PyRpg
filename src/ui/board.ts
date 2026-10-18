// 그림자 게시판(design.md §7.6) + 일일 퀘스트·스트릭(§7.5). 마을 게시판과 메뉴의 '퀘스트'에서 연다.
import type { BoardUI, BoardView, NameContext, QuestPanelView, StreakView } from "../contracts/ui";
import { withJosa } from "../app/josa";
import { h } from "./dom";
import type { UiEnv } from "./env";

/** 머리글·닫기 버튼이 있는 큰 창. 닫으면 onClose */
export function shellModal(env: UiEnv, opts: { className: string; label: string; title: string; onClose: () => void }) {
  const modal = env.stack.open({ className: opts.className, label: opts.label, onEscape: opts.onClose });
  const closeBtn = h("button", { class: "btn btn-icon sys-close", type: "button", "aria-label": "닫기", title: "닫기" }, "×");
  closeBtn.addEventListener("click", opts.onClose);
  const body = h("div", { class: "sys-body" });
  const panel = h("div", { class: "panel sys-panel" }, h("header", { class: "sys-head" }, h("h2", {}, opts.title), closeBtn), body);
  modal.el.append(panel);
  return { modal, body, closeBtn, panel };
}

function boxPips(box: number): HTMLElement {
  const el = h("span", { class: "box-pips", "aria-label": `칸 ${box}/5` });
  for (let i = 0; i <= 5; i++) el.append(h("span", { class: `box-pip ${i <= box ? "is-on" : ""}` }));
  return el;
}

export function questPanel(q: QuestPanelView): HTMLElement {
  const list = h("ul", { class: "quest-list" });
  for (const it of q.quests) {
    list.append(
      h(
        "li",
        { class: `quest-item ${it.done ? "is-done" : ""}`, "data-quest": it.id },
        h("span", { class: "quest-check", "aria-hidden": "true" }, it.done ? "✓" : "·"),
        h("span", { class: "quest-text" }, it.text),
        h("span", { class: "quest-progress" }, `${it.progress}/${it.count}`),
      ),
    );
  }
  const items = q.chest.items.map((i) => `${i.name} ${i.count}개`).join(", ");
  const chestText = `금화 ${q.chest.gold}${items ? ` + ${items}` : ""}`;
  return h(
    "section",
    { class: "sys-section quest-panel" },
    h("h3", {}, `오늘의 퀘스트 (${q.quests.filter((x) => x.done).length}/${q.quests.length})`),
    list,
    h("p", { class: "quest-reward" }, `하나에 ${q.reward.xp} XP · ${q.reward.gold} G`),
    h(
      "p",
      { class: `quest-chest ${q.chest.claimed ? "is-claimed" : ""}` },
      h("span", { class: "chest-icon", "aria-hidden": "true" }),
      q.chest.claimed ? `상자를 받았어! (${chestText})` : `3개를 다 하면 상자: ${chestText}`,
    ),
  );
}

export function streakPanel(s: StreakView): HTMLElement {
  const week = h("div", { class: `streak-week ${s.weekDays >= s.weekGoal ? "is-goal" : ""}` }, `이번 주 ${s.weekDays}/7`);
  const els: HTMLElement[] = [
    h("h3", {}, "스트릭"),
    h("div", { class: "streak-row" }, week, h("span", { class: "streak-goal" }, `목표 ${s.weekGoal}일`), h("span", { class: "streak-days" }, `연속 ${s.streak}일`)),
    h(
      "p",
      { class: "streak-protect" },
      `모닥불 불씨 ${s.embers} · 얼음 룬 ${s.iceRunes} (합쳐서 ${s.maxProtections}개까지). 빠진 날이 생기면 불씨부터 자동으로 써서 지켜 줘.`,
    ),
    h("p", { class: "streak-today" }, `오늘 처치 ${s.todayCount}/${s.emberThreshold} · ${s.emberThreshold}번 처치하면 불씨 1개 충전`),
    // 스트릭 인정 조건(design.md §7.5, 단위 3-E3): 연습 전투 승리·새 레슨 첫 완료도 그날을 인정하지만 처치 수에는 넣지 않는다
    h("p", { class: "streak-rule" }, "전투나 그림자 1마리를 처치하면 오늘이 인정돼. 연습 전투 승리나 새 레슨 첫 완료도 인정되지만, 불씨·복구의 처치 수에는 세지 않아."),
  ];
  if (s.repair) {
    els.push(
      h(
        "p",
        { class: "streak-repair", role: "status" },
        `끊긴 ${s.repair.previousStreak}일 스트릭을 되살릴 수 있어! 오늘 전투 ${s.repair.battlesLeft}개만 더 끝내면 ${withJosa(s.repair.missedDays.join(", "), "이/가")} 메워져.`,
      ),
    );
  }
  return h("section", { class: "sys-section streak-panel" }, ...els);
}

export function createBoardUI(env: UiEnv): BoardUI {
  return {
    open(view: BoardView, names: NameContext) {
      return new Promise<string | null>((resolve) => {
        const done = (v: string | null) => {
          shell.modal.close();
          resolve(v);
        };
        const shell = shellModal(env, { className: "board-modal", label: "그림자 게시판", title: "그림자 게시판", onClose: () => done(null) });
        const list = h("ul", { class: "shadow-list" });
        let first: HTMLButtonElement | null = null;
        for (const s of view.shadows) {
          const btn = h("button", { class: "btn btn-primary board-fight", type: "button", "data-concept": s.concept }, "처치하러 가기");
          btn.addEventListener("click", () => done(s.concept));
          first ??= btn;
          const next = s.returning
            ? "귀환 그림자: 이기면 완전히 정화"
            : s.nextIntervalDays === 0
              ? "이기면 정화!"
              : `힌트 없이 이기면 ${s.nextIntervalDays}일 뒤 다시`;
          list.append(
            h(
              "li",
              { class: `shadow-card ${s.returning ? "is-returning" : ""} ${s.anonymous ? "is-anonymous" : ""}`, "data-concept": s.concept },
              h("span", { class: "shadow-icon", "aria-hidden": "true" }),
              h(
                "div",
                { class: "shadow-info" },
                // 칸 3 이상은 주문서 이름 대신 '이름 없는 그림자'(이긴 뒤 공개, design.md §7.6)
                h("div", { class: "shadow-name" }, s.anonymous ? s.name : `그림자 · ${s.name}`),
                h(
                  "div",
                  { class: "shadow-meta" },
                  boxPips(s.box),
                  h("span", { class: "shadow-box" }, `칸 ${s.box}`),
                  h("span", { class: "shadow-minutes" }, `약 ${s.minutes}분`),
                  s.overdueDays > 0 ? h("span", { class: "shadow-overdue" }, `${s.overdueDays}일 밀림`) : null,
                ),
                h("div", { class: "shadow-next" }, next),
              ),
              btn,
            ),
          );
        }
        // 대기(design.md §7.6 하루 계획 2): 원래 몬스터를 아직 못 이겼거나 오늘 이긴 그림자. 고를 수 없다
        const pendingList = h("ul", { class: "shadow-pending-list" });
        for (const s of view.pending) {
          pendingList.append(
            h(
              "li",
              { class: `shadow-pending ${s.anonymous ? "is-anonymous" : ""}`, "data-concept": s.concept },
              h("span", { class: "shadow-pending-name" }, s.anonymous ? s.name : `그림자 · ${s.name}`),
              h("span", { class: "shadow-box" }, `칸 ${s.box}`),
              h(
                "span",
                { class: "shadow-pending-why" },
                s.reason === "unsolved" ? "원래 몬스터를 이긴 다음 날부터 나타나" : "오늘 원래 몬스터를 이겼으니 내일부터 나타나",
              ),
            ),
          );
        }
        const intro =
          view.shadows.length > 0
            ? `오늘 나타난 그림자야. 이기면 보상은 원래의 절반이지만, 개념이 단단해져!`
            : view.foughtToday >= view.dailyLimit
              ? `오늘 그림자는 ${view.dailyLimit}마리까지야. 다 상대했으니 푹 쉬어도 돼!`
              : view.foughtToday > 0 && view.deferred > 0
                ? `오늘 복습은 여기까지! 그림자는 하루 ${view.budgetMinutes}분 정도만 낼게. 남은 그림자는 내일 나타날 거야.`
                : view.pending.length > 0
                  ? `지금은 기다리는 그림자만 있어. 원래 몬스터를 이긴 다음 날부터 나타날 거야.`
                  : view.waiting > 0
                    ? `오늘은 그림자가 조용해. 기다리는 그림자 ${view.waiting}마리는 날이 되면 나타날 거야.`
                    : `아직 그림자가 없어. 힌트를 많이 쓰거나 쓰러진 개념이 여기 나타나.`;
        // 오늘 복습 예상(design.md §7.6 하루 계획 7)
        const budget =
          view.shadows.length > 0 || view.usedMinutes > 0
            ? h(
                "p",
                { class: "shadow-budget" },
                `오늘 복습 예상 약 ${view.plannedMinutes}분`,
                view.usedMinutes > 0 ? h("span", { class: "shadow-budget-used" }, ` · 오늘 치른 그림자 약 ${view.usedMinutes}분`) : null,
              )
            : null;
        shell.body.append(
          h(
            "section",
            { class: "sys-section shadow-panel" },
            h("h3", {}, `오늘 나타난 그림자 (${view.shadows.length})`),
            h("p", { class: "sys-nuri" }, h("span", { class: "nuri-name" }, names.companion), intro),
            budget,
            view.shadows.length ? list : null,
            view.pending.length ? h("h4", { class: "shadow-pending-head" }, `기다리는 그림자 (${view.pending.length})`) : null,
            view.pending.length ? pendingList : null,
          ),
          questPanel(view.quests),
          streakPanel(view.streak),
        );
        env.stack.focusInitial(shell.modal, first ?? shell.closeBtn);
      });
    },

    openQuests(view) {
      return new Promise<void>((resolve) => {
        const close = () => {
          shell.modal.close();
          resolve();
        };
        const shell = shellModal(env, { className: "quests-modal", label: "퀘스트", title: "퀘스트", onClose: close });
        shell.body.append(questPanel(view.quests), streakPanel(view.streak));
        env.stack.focusInitial(shell.modal, shell.closeBtn);
      });
    },
  };
}
