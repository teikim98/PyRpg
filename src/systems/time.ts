// 날짜 계산(design.md §7.5). 하루의 경계는 기기 시간 기준 새벽 4시.
// 학습 날짜는 "YYYY-MM-DD" 문자열로 다루고, 날짜 산술은 UTC 자정 기준으로 해서 시간대·서머타임 영향을 없앤다.

export const DAY_BOUNDARY_HOUR = 4;
const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/** 새벽 4시 전이면 전날로 친 학습 날짜 */
export function studyDate(now: Date): string {
  let y = now.getFullYear();
  let m = now.getMonth();
  let d = now.getDate();
  if (now.getHours() < DAY_BOUNDARY_HOUR) {
    const prev = new Date(y, m, d - 1);
    y = prev.getFullYear();
    m = prev.getMonth();
    d = prev.getDate();
  }
  return `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`;
}

export function isDateString(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return formatUtc(t) === s;
}

function parseDate(s: string): number {
  const m = DATE_RE.exec(s);
  if (!m) throw new Error(`날짜 형식이 아닙니다: ${s}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function formatUtc(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, n: number): string {
  return formatUtc(parseDate(date) + n * DAY_MS);
}

/** b − a (일). a가 더 늦으면 음수 */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

/** 그 날짜가 속한 주의 월요일 */
export function weekStart(date: string): string {
  const dow = new Date(parseDate(date)).getUTCDay(); // 0=일
  return addDays(date, -((dow + 6) % 7));
}

/** 월요일~일요일 7일 */
export function weekDates(date: string): string[] {
  const mon = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}
