// 서비스들이 함께 쓰는 UI 환경
import type { ModalStack } from "./dom";

export interface UiOptions {
  /** 대화창·레슨에서 쓰는 보조 캐릭터 초상화 접두어(manifest). 기본 "portrait_nuri" */
  companionPortrait?: string;
  /** 타자기 효과 글자 간격(ms). 0이면 바로 전부 표시 */
  typeSpeedMs?: number;
}

export interface UiEnv {
  root: HTMLElement;
  modalLayer: HTMLElement;
  hudLayer: HTMLElement;
  toastLayer: HTMLElement;
  stack: ModalStack;
  companionPortrait: string;
  typeSpeedMs: number;
}
