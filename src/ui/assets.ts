// 초상화·스프라이트 요소. 파일이 없거나 못 읽으면 색 자리표시자로 대신한다.
import { manifest } from "../contracts/assets";
import type { Emotion } from "../contracts/content";
import { h } from "./dom";

export function assetUrl(file: string): string {
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? "/";
  return base.replace(/\/?$/, "/") + file.replace(/^\//, "");
}

const EMOTION_LABEL: Record<Emotion, string> = {
  neutral: "기본",
  happy: "기쁨",
  worried: "걱정",
  surprised: "놀람",
  serious: "진지",
};

export interface PortraitHandle {
  el: HTMLElement;
  set(emotion: Emotion | undefined): void;
}

/** 48×48 초상화를 scale배로(정수배) 그린다 */
export function createPortrait(prefix: string, scale: number, initial: string): PortraitHandle {
  const size = 48 * scale;
  const img = h("img", { class: "portrait-img", alt: "", width: size, height: size, draggable: "false" });
  const fallback = h("div", { class: "portrait-fallback" }, h("span", { class: "portrait-initial" }, initial));
  const el = h("div", { class: "portrait", style: `width:${size}px;height:${size}px` }, img, fallback);
  let current = "";
  const showFallback = (emotion: Emotion) => {
    el.classList.add("is-fallback");
    el.dataset.emotion = emotion;
    fallback.title = EMOTION_LABEL[emotion];
  };
  img.addEventListener("error", () => showFallback((el.dataset.emotion as Emotion) ?? "neutral"));
  img.addEventListener("load", () => el.classList.remove("is-fallback"));
  return {
    el,
    set(emotion = "neutral") {
      el.dataset.emotion = emotion;
      const key = `${prefix}_${emotion}`;
      const entry = manifest.portraits[key] ?? manifest.portraits[`${prefix}_neutral`];
      if (!entry) {
        showFallback(emotion);
        return;
      }
      if (current === entry.file && !el.classList.contains("is-fallback")) return;
      current = entry.file;
      img.src = assetUrl(entry.file);
      if (el.classList.contains("is-fallback")) fallback.title = EMOTION_LABEL[emotion];
    },
  };
}

/** 스프라이트 첫 줄 프레임을 제자리 애니메이션으로 그린다(정수배 확대) */
export function createSprite(name: string, scale: number, label: string): HTMLElement {
  const s = manifest.sprites[name];
  const fw = s?.frameWidth ?? 16;
  const fhgt = s?.frameHeight ?? 16;
  const w = fw * scale;
  const hgt = fhgt * scale;
  const el = h("div", {
    class: "sprite is-fallback",
    style: `width:${w}px;height:${hgt}px;--frame-w:${w}px`,
    "data-sprite": name,
    "aria-label": label,
    role: "img",
  });
  el.append(h("span", { class: "sprite-fallback-eye l" }), h("span", { class: "sprite-fallback-eye r" }));
  if (s) {
    const url = assetUrl(s.file);
    const probe = new Image();
    probe.onload = () => {
      const frames = Math.max(1, Math.floor(probe.naturalWidth / fw));
      el.classList.remove("is-fallback");
      el.replaceChildren();
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = `${probe.naturalWidth * scale}px ${probe.naturalHeight * scale}px`;
      // 첫 줄의 프레임 2개로 제자리 애니메이션
      if (frames >= 2) el.classList.add("is-animated");
    };
    probe.src = url;
  }
  return el;
}
