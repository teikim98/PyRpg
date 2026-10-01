// 승리 보상 창과 실전 추천 문제 창(design.md §7.1, §7.7)
import type { Problem, RecommendedProblem } from "../contracts/content";
import type { RewardSummary } from "../contracts/state";
import type { RewardUI } from "../contracts/ui";
import { h } from "./dom";
import type { UiEnv } from "./env";

export const PROGRAMMERS_URL = "https://school.programmers.co.kr/learn/courses/30/lessons/";

export function programmersUrl(id: number): string {
  return `${PROGRAMMERS_URL}${id}`;
}

/** BOJ_BASE_URL과 번호를 조합. "{id}"가 있으면 그 자리에, 없으면 끝에 /번호를 붙인다 */
export function bojUrl(base: string, id: number): string {
  if (base.includes("{id}")) return base.replace("{id}", String(id));
  return `${base.replace(/\/+$/, "")}/${id}`;
}

function simpleModal(env: UiEnv, className: string, label: string, build: (close: () => void) => HTMLElement[], okLabel = "확인"): Promise<void> {
  return new Promise((resolve) => {
    const close = () => {
      modal.close();
      resolve();
    };
    const modal = env.stack.open({ className, label, onEscape: close });
    const ok = h("button", { class: "btn btn-primary reward-ok", type: "button" }, okLabel);
    ok.addEventListener("click", close);
    modal.el.append(h("div", { class: "panel reward-panel" }, ...build(close), h("div", { class: "reward-bar" }, ok)));
    env.stack.focusInitial(modal, ok);
  });
}

export function createRewardUI(env: UiEnv): RewardUI {
  return {
    show(summary: RewardSummary, problem: Problem) {
      return simpleModal(env, "reward-modal", "전투 보상", () => {
        const rows: HTMLElement[] = [];
        const row = (label: string, value: string, cls = "") =>
          h("div", { class: `reward-row ${cls}` }, h("span", { class: "reward-label" }, label), h("span", { class: "reward-value" }, value));
        rows.push(row("경험치", `+${summary.xp} XP`, "reward-xp"));
        rows.push(row("골드", `+${summary.gold} G`, "reward-gold"));
        if (summary.penalty >= 1) rows.push(row("대가", "해설서를 열어서 이번 보상은 없어", "reward-penalty"));
        else if (summary.penalty > 0) rows.push(row("힌트 대가", `보상 −${Math.round(summary.penalty * 100)}%`, "reward-penalty"));
        const els: HTMLElement[] = [
          h("div", { class: "reward-caption" }, problem.boss ? "보스 격파!" : "승리!"),
          h("h2", { class: "reward-title" }, `${problem.enemy.name} 정화`),
          h("p", { class: "reward-sub" }, problem.title),
          h("div", { class: "reward-rows" }, ...rows),
        ];
        if (summary.levelAfter > summary.levelBefore) {
          els.push(h("div", { class: "reward-levelup", role: "status" }, `레벨 업! Lv ${summary.levelBefore} → Lv ${summary.levelAfter}`));
        }
        if (summary.shadowNote) els.push(h("p", { class: "reward-shadow" }, summary.shadowNote));
        if (summary.streakCounted) els.push(h("p", { class: "reward-streak" }, "오늘의 학습 인정! 모닥불이 타올라."));
        return els;
      });
    },

    showRecommended(regionName: string, items: RecommendedProblem[], bojBaseUrl: string | null) {
      return simpleModal(env, "recommend-modal", "실전 추천", () => {
        // 프로그래머스를 맨 위에(§7.7)
        const sorted = [...items].sort((a, b) => (a.site === b.site ? 0 : a.site === "programmers" ? -1 : 1));
        const list = h("ul", { class: "recommend-list" });
        let bojDisabled = false;
        for (const it of sorted) {
          const site = it.site === "programmers" ? "프로그래머스" : "백준";
          const meta = h("span", { class: "recommend-meta" }, `${site} · ${it.level}`);
          let main: HTMLElement;
          if (it.site === "programmers") {
            main = h("a", { class: "recommend-link", href: programmersUrl(it.id), target: "_blank", rel: "noopener noreferrer" }, it.title);
          } else if (bojBaseUrl) {
            main = h("a", { class: "recommend-link", href: bojUrl(bojBaseUrl, it.id), target: "_blank", rel: "noopener noreferrer" }, `${it.id}번 ${it.title}`);
          } else {
            bojDisabled = true;
            main = h("span", { class: "recommend-link is-disabled", "aria-disabled": "true", title: "백준 재개 전까지 링크 비활성" }, `${it.id}번 ${it.title}`);
          }
          list.append(h("li", { class: `recommend-item site-${it.site}`, "data-site": it.site, "data-id": String(it.id) }, main, meta));
        }
        const els: HTMLElement[] = [
          h("div", { class: "reward-caption" }, "실전 추천"),
          h("h2", { class: "reward-title" }, `${regionName} 클리어!`),
          h("p", { class: "reward-sub" }, "이 지역의 주문을 실제 코딩테스트 문제로 연습해 보자."),
          list,
        ];
        if (bojDisabled) els.push(h("p", { class: "recommend-note" }, "백준 재개 전까지 링크 비활성"));
        return els;
      });
    },
  };
}
