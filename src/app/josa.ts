// 받침에 맞는 조사(토스트·안내·전투 문구용). 이름이 바뀌어도 "사서 골렘을", "고블린 족장을"처럼 자연스럽게 붙인다.
// 판단은 마지막 글자로 한다: 한글이면 받침, 숫자면 한국어로 읽은 소리(1 일, 2 이, 10 십 …).
// 영어 등 알 수 없는 글자로 끝나면 두 형태를 다 쓴다(예: '을(를)').

/** 마지막 소리의 받침. none: 받침 없음, rieul: ㄹ 받침(으로/로 구별용), other: 그 밖의 받침 */
type Final = "none" | "rieul" | "other";

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 종성 인덱스 8이 ㄹ */
const JONG_RIEUL = 8;
/** 숫자를 한국어로 읽은 마지막 소리: 0 영(…십·백·천·만도 받침), 1 일, 2 이, 3 삼, 4 사, 5 오, 6 육, 7 칠, 8 팔, 9 구 */
const DIGIT_FINAL: Record<string, Final> = {
  "0": "other",
  "1": "rieul",
  "2": "none",
  "3": "other",
  "4": "none",
  "5": "none",
  "6": "other",
  "7": "rieul",
  "8": "rieul",
  "9": "none",
};
/** 판단할 때 건너뛰는 끝 글자(닫는 괄호·따옴표·공백). 예: 「첫 주문」 → '문' */
const TRAILING = /[\s)\]}」』"'’”>]+$/u;

function finalOf(word: string): Final | undefined {
  const w = word.replace(TRAILING, "");
  if (!w) return undefined;
  const last = w.charAt(w.length - 1);
  const code = last.charCodeAt(0);
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
    const jong = (code - HANGUL_FIRST) % 28;
    return jong === 0 ? "none" : jong === JONG_RIEUL ? "rieul" : "other";
  }
  return DIGIT_FINAL[last];
}

/** 받침이 있으면 true, 없으면 false, 알 수 없으면 undefined */
export function hasFinalConsonant(word: string): boolean | undefined {
  const f = finalOf(word);
  return f === undefined ? undefined : f !== "none";
}

/** 받침 있을 때 / 없을 때 형태. 으로/로는 ㄹ 받침도 '로' */
export type JosaPair = "을/를" | "이/가" | "은/는" | "과/와" | "으로/로";

const FALLBACK: Record<JosaPair, string> = {
  "을/를": "을(를)",
  "이/가": "이(가)",
  "은/는": "은(는)",
  "과/와": "과(와)",
  "으로/로": "(으)로",
};

/** word 뒤에 붙일 조사만 돌려준다. 예: josa("사서 골렘", "을/를") → "을" */
export function josa(word: string, pair: JosaPair): string {
  const f = finalOf(word);
  if (f === undefined) return FALLBACK[pair];
  const [withFinal, withoutFinal] = pair.split("/") as [string, string];
  if (pair === "으로/로") return f === "other" ? withFinal : withoutFinal;
  return f === "none" ? withoutFinal : withFinal;
}

/** word에 조사를 붙여 돌려준다. 예: withJosa("회복약", "을/를") → "회복약을" */
export function withJosa(word: string, pair: JosaPair): string {
  return `${word}${josa(word, pair)}`;
}

/** 목적격 조사: 받침이 있으면 '을', 없으면 '를'. 알 수 없으면 '을(를)' */
export function objectParticle(word: string): string {
  return josa(word, "을/를");
}

/** 주격 조사: 받침이 있으면 '이', 없으면 '가'. 알 수 없으면 '이(가)' */
export function subjectParticle(word: string): string {
  return josa(word, "이/가");
}

/** 보조사: 받침이 있으면 '은', 없으면 '는'. 알 수 없으면 '은(는)' */
export function topicParticle(word: string): string {
  return josa(word, "은/는");
}

/** 접속 조사: 받침이 있으면 '과', 없으면 '와'. 알 수 없으면 '과(와)' */
export function andParticle(word: string): string {
  return josa(word, "과/와");
}

/** 방향 조사: ㄹ 이외의 받침이면 '으로', 받침이 없거나 ㄹ이면 '로'. 알 수 없으면 '(으)로' */
export function directionParticle(word: string): string {
  return josa(word, "으로/로");
}
