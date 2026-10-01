// 작은 Markdown 렌더러(design.md §11.2). 결과는 HTML 문자열이고, 모든 텍스트는 이스케이프한다.
// 지원: 제목, 문단, 굵게/기울임, 인라인 코드, 펜스 코드, 목록, 인용, 간단한 표, 링크(http/https만), 구분선.
// ```python run → .md-run(실행 버튼은 enhance 단계에서 붙인다), ```js compare → 'JavaScript와 비교' 박스.

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

const PH = "\u0000";

/** 인라인 서식. 코드 스팬 안은 서식을 적용하지 않는다 */
export function renderInline(text: string): string {
  const store: string[] = [];
  const hold = (html: string) => `${PH}${store.push(html) - 1}${PH}`;
  let s = text.replace(/\u0000/g, "");

  // 1. 코드 스팬
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_m, _ticks: string, body: string) => {
    let b = body.replace(/\n/g, " ");
    if (b.length > 2 && b.startsWith(" ") && b.endsWith(" ")) b = b.slice(1, -1);
    return hold(`<code>${escapeHtml(b)}</code>`);
  });
  // 2. 역슬래시 이스케이프
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, (_m, c: string) => hold(escapeHtml(c)));
  // 3. 링크: 안전한 스킴만 허용, 나머지는 글자만 남긴다
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const inner = renderInlineNoStore(label, store);
    if (/^(https?:\/\/|mailto:)/i.test(url)) {
      return hold(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`);
    }
    return hold(inner);
  });
  s = formatEscaped(escapeHtml(s));
  return restore(s, store);
}

// 링크 라벨용: 같은 저장소를 쓰는 서식 처리(코드 스팬 자리표시자는 이미 들어 있음)
function renderInlineNoStore(text: string, store: string[]): string {
  return restore(formatEscaped(escapeHtml(text)), store);
}

function formatEscaped(s: string): string {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/(^|[^\w*])\*(?![\s*])([^*\n]*?[^\s*])\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_(?![\s_])([^_\n]*?[^\s_])_(?![\w_])/g, "$1<em>$2</em>")
    .replace(/ {2,}\n/g, "<br>\n");
}

function restore(s: string, store: string[]): string {
  const re = new RegExp(`${PH}(\\d+)${PH}`, "g");
  for (let i = 0; i < 5 && s.includes(PH); i++) s = s.replace(re, (_m, n: string) => store[Number(n)] ?? "");
  return s;
}

// ---------- 블록 ----------

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([^`]*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function indentOf(line: string): number {
  const m = /^ */.exec(line.replace(/\t/g, "    "));
  return m ? m[0].length : 0;
}

function startsBlock(lines: string[], i: number): boolean {
  const l = lines[i];
  return (
    FENCE.test(l) ||
    HEADING.test(l) ||
    HR.test(l) ||
    QUOTE.test(l) ||
    /^\s*([-*+]|\d{1,9}[.)])\s+\S/.test(l) ||
    (l.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-"))
  );
}

function splitRow(row: string): string[] {
  let r = row.trim();
  if (r.startsWith("|")) r = r.slice(1);
  if (r.endsWith("|") && !r.endsWith("\\|")) r = r.slice(0, -1);
  // 코드 스팬 안의 | 와 \| 는 칸 구분자가 아니다
  const cells: string[] = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (c === "\\" && r[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (c === "`") {
      inCode = !inCode;
      cur += c;
    } else if (c === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * 표 칸 안의 `<br>`(GFM 관례)을 줄바꿈으로 그린다. 표 한 칸에는 줄바꿈을 쓸 수 없어서 여러 줄 예제 입출력에 쓴다.
 * 코드 스팬 안의 `<br>`은 글자 그대로 두고, 나머지 글자는 renderInline이 이스케이프한다.
 */
function renderCell(cell: string): string {
  const parts: string[] = [];
  let cur = "";
  let ticks = 0;
  for (let i = 0; i < cell.length; i++) {
    if (cell[i] === "`") {
      let n = 1;
      while (cell[i + n] === "`") n++;
      if (ticks === 0) ticks = n;
      else if (ticks === n) ticks = 0;
      cur += cell.slice(i, i + n);
      i += n - 1;
      continue;
    }
    const m = ticks === 0 ? /^<br\s*\/?>/i.exec(cell.slice(i)) : null;
    if (m) {
      parts.push(cur);
      cur = "";
      i += m[0].length - 1;
      continue;
    }
    cur += cell[i];
  }
  parts.push(cur);
  return parts.map((p) => renderInline(p.trim())).join("<br>");
}

function renderFence(info: string, body: string): string {
  const words = info.trim().split(/\s+/).filter(Boolean);
  const lang = (words[0] ?? "").toLowerCase();
  const flags = words.slice(1).map((w) => w.toLowerCase());
  const code = escapeHtml(body);
  if (lang === "python" && flags.includes("run")) {
    return `<div class="md-run"><pre class="md-code"><code class="language-python">${code}</code></pre></div>`;
  }
  if ((lang === "js" || lang === "javascript") && flags.includes("compare")) {
    return `<div class="md-compare"><div class="md-compare-title">JavaScript와 비교</div><pre class="md-code"><code class="language-js">${code}</code></pre></div>`;
  }
  const safeLang = lang.replace(/[^a-z0-9-]/g, "");
  return `<pre class="md-code"><code${safeLang ? ` class="language-${safeLang}"` : ""}>${code}</code></pre>`;
}

function parseList(lines: string[], start: number): { html: string; next: number } {
  const first = LIST_ITEM.exec(lines[start])!;
  const base = indentOf(lines[start]);
  const ordered = /\d/.test(first[2]);
  const items: string[][] = [];
  let contentIndent = 0;
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      // 빈 줄 뒤에도 같은 목록이 이어지는지 본다
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j >= lines.length) break;
      const m = LIST_ITEM.exec(lines[j]);
      const ind = indentOf(lines[j]);
      if ((m && ind === base && /\d/.test(m[2]) === ordered) || ind >= contentIndent) {
        items[items.length - 1].push("");
        i++;
        continue;
      }
      break;
    }
    const m = LIST_ITEM.exec(line);
    const ind = indentOf(line);
    if (m && ind >= base && ind < base + 2) {
      if (/\d/.test(m[2]) !== ordered) break;
      items.push([m[3]]);
      contentIndent = ind + m[2].length + 1;
      i++;
      continue;
    }
    if (ind > base) {
      const strip = Math.min(ind, contentIndent);
      items[items.length - 1].push(line.replace(/\t/g, "    ").slice(strip));
      i++;
      continue;
    }
    // 들여쓰지 않은 이어지는 줄(게으른 연속)
    if (!startsBlock(lines, i) && ind <= base) {
      items[items.length - 1].push(line.trim());
      i++;
      continue;
    }
    break;
  }
  const lis = items.map((content) => {
    let html = parseBlocks(content);
    // 첫 문단은 <p> 없이(촘촘한 목록)
    if (html.startsWith("<p>")) {
      const end = html.indexOf("</p>");
      html = html.slice(3, end) + html.slice(end + 4);
    }
    return `<li>${html}</li>`;
  });
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const tag = ordered ? "ol" : "ul";
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : "";
  return { html: `<${tag}${startAttr}>${lis.join("")}</${tag}>`, next: i };
}

function parseBlocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const ind = fence[1].length;
      const marker = fence[2];
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trim();
        if (t.startsWith(marker[0].repeat(marker.length)) && /^(`+|~+)$/.test(t)) {
          i++;
          break;
        }
        body.push(l.slice(Math.min(ind, indentOf(l))));
        i++;
      }
      out.push(renderFence(fence[3], body.join("\n")));
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && !isBlank(lines[i])) {
        const q = QUOTE.exec(lines[i]);
        if (q) inner.push(q[1]);
        else if (!startsBlock(lines, i)) inner.push(lines[i]);
        else break;
        i++;
      }
      out.push(`<blockquote>${parseBlocks(inner)}</blockquote>`);
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : "",
      );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cell = (tag: string, c: string, k: number) =>
        `<${tag}${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${renderCell(c)}</${tag}>`;
      const thead = `<thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead>`;
      const tbody = rows.length
        ? `<tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell("td", r[k] ?? "", k)).join("")}</tr>`).join("")}</tbody>`
        : "";
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const r = parseList(lines, i);
      out.push(r.html);
      i = r.next;
      continue;
    }
    // 문단
    const para: string[] = [line.replace(/^\s+/, "")];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      para.push(lines[i].replace(/^\s+/, ""));
      i++;
    }
    out.push(`<p>${renderInline(para.join("\n"))}</p>`);
  }
  return out.join("\n");
}

export function renderMarkdown(md: string): string {
  return parseBlocks(md.replace(/\r\n?/g, "\n").split("\n"));
}

/** 이름 치환({player}, {companion}) */
export function substituteNames(text: string, names: { player: string; companion: string }): string {
  // 함수로 넘겨야 이름 속의 $&, $' 같은 문자열이 치환 패턴으로 해석되지 않는다
  return text.replace(/\{player\}/g, () => names.player).replace(/\{companion\}/g, () => names.companion);
}
