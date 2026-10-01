// 픽셀 폰트 등록. galmuri 패키지의 galmuri.css를 통째로 가져오면 모든 굵기·크기의 ttf까지(수십 MB) 빌드에 들어가므로,
// 쓰는 woff2 세 개만 FontFace로 등록한다. Neo둥근모 Code는 패키지 CSS를 그대로 쓴다.
import "@kfonts/neodgm-code/index.css";
import galmuri11 from "galmuri/dist/Galmuri11.woff2?url";
import galmuri11Bold from "galmuri/dist/Galmuri11-Bold.woff2?url";
import galmuri14 from "galmuri/dist/Galmuri14.woff2?url";

let registered = false;

export function registerFonts(): void {
  if (registered || typeof FontFace === "undefined" || typeof document === "undefined") return;
  registered = true;
  const faces = [
    new FontFace("Galmuri11", `url("${galmuri11}") format("woff2")`, { weight: "400", display: "swap" }),
    new FontFace("Galmuri11", `url("${galmuri11Bold}") format("woff2")`, { weight: "700", display: "swap" }),
    new FontFace("Galmuri14", `url("${galmuri14}") format("woff2")`, { weight: "400", display: "swap" }),
  ];
  for (const f of faces) {
    document.fonts.add(f);
    f.load().catch(() => {
      /* 폰트를 못 읽어도 대체 글꼴로 계속 */
    });
  }
}
