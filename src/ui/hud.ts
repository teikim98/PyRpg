// 상단 HUD와 토스트(design.md §7.5: "이번 주 n/7"을 크게)
import type { HudState, HudUI } from "../contracts/ui";
import { h } from "./dom";
import type { UiEnv } from "./env";

function bar(className: string, label: string) {
  const fill = h("div", { class: "bar-fill" });
  const el = h("div", { class: `bar ${className}`, role: "progressbar", "aria-label": label, "aria-valuemin": "0" }, fill);
  return {
    el,
    set(value: number, max: number) {
      const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
      fill.style.width = `${pct}%`;
      el.setAttribute("aria-valuenow", String(value));
      el.setAttribute("aria-valuemax", String(max));
    },
  };
}

export function createHudUI(env: UiEnv): HudUI {
  const region = h("span", { class: "hud-region" });
  const level = h("span", { class: "hud-level" });
  const xpBar = bar("bar-xp", "경험치");
  const xpText = h("span", { class: "hud-small" });
  const hpBar = bar("bar-hp", "HP");
  const hpText = h("span", { class: "hud-small hud-hp-text" });
  const gold = h("span", { class: "hud-gold" });
  const week = h("span", { class: "hud-week" });
  const scrolls = h("span", { class: "hud-scrolls" });
  const el = h(
    "div",
    { class: "hud panel", hidden: true },
    h("div", { class: "hud-group" }, region),
    h("div", { class: "hud-group" }, level, xpBar.el, xpText),
    h("div", { class: "hud-group" }, h("span", { class: "hud-label" }, "HP"), hpBar.el, hpText),
    h("div", { class: "hud-group" }, gold),
    h("div", { class: "hud-group" }, scrolls),
    h("div", { class: "hud-group hud-week-group" }, week),
  );
  env.hudLayer.append(el);

  return {
    update(s: HudState) {
      el.hidden = false;
      region.textContent = s.regionName;
      level.textContent = `Lv ${s.level}`;
      xpBar.set(s.xp, s.xpToNext);
      xpText.textContent = `${s.xp}/${s.xpToNext}`;
      hpBar.set(s.hp, s.maxHp);
      hpText.textContent = `${s.hp}/${s.maxHp}`;
      el.classList.toggle("is-low-hp", s.maxHp > 0 && s.hp / s.maxHp <= 0.3);
      gold.textContent = `${s.gold} G`;
      scrolls.textContent = `주문서 ${s.scrolls}`;
      week.textContent = `이번 주 ${s.weekDays}/7`;
      week.classList.toggle("is-goal", s.weekDays >= 5);
    },
    toast(message: string) {
      const t = h("div", { class: "toast panel", role: "status" }, message);
      env.toastLayer.append(t);
      // 너무 많이 쌓이지 않게
      while (env.toastLayer.children.length > 4) env.toastLayer.firstElementChild?.remove();
      setTimeout(() => t.classList.add("is-leaving"), 2600);
      setTimeout(() => t.remove(), 3000);
    },
  };
}
