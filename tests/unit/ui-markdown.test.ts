import { describe, expect, it } from "vitest";
import { escapeHtml, renderInline, renderMarkdown, substituteNames } from "../../src/ui/markdown";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("renderMarkdown escaping", () => {
  it("never emits raw tags from text", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes inside headings, lists, quotes and tables", () => {
    const md = ["# <b>h</b>", "- <i>x</i>", "> <u>q</u>", "", "| a | b |", "|---|---|", "| <x> | `<y>` |"].join("\n");
    const html = renderMarkdown(md);
    expect(html).not.toMatch(/<(b|i|u|x|y)>/);
    expect(html).toContain("<h1>&lt;b&gt;h&lt;/b&gt;</h1>");
    expect(html).toContain("<td>&lt;x&gt;</td>");
    expect(html).toContain("<td><code>&lt;y&gt;</code></td>");
  });

  it("escapes code blocks and inline code", () => {
    const html = renderMarkdown('```python\nprint("<b>" & 1)\n```\n\n`a < b && "c"`');
    expect(html).toContain("print(&quot;&lt;b&gt;&quot; &amp; 1)");
    expect(html).toContain("<code>a &lt; b &amp;&amp; &quot;c&quot;</code>");
  });

  it("does not create javascript: links and escapes link attributes", () => {
    const html = renderInline('[x](javascript:alert(1)) [y](https://e.com/?a="b"&c=<d>)');
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://e.com/?a=&quot;b&quot;&amp;c=&lt;d&gt;"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not let placeholder characters inject stored html", () => {
    const html = renderInline("\u00000\u0000 `x`");
    expect(html).toBe("0 <code>x</code>");
  });

  it("sanitizes fence language class", () => {
    const html = renderMarkdown('```py"><script>\nx\n```');
    expect(html).not.toContain("<script");
    expect(html).toContain('class="language-pyscript"');
  });
});

describe("renderMarkdown blocks", () => {
  it("renders headings, paragraphs and inline styles", () => {
    const html = renderMarkdown("## 제목\n\n**굵게**와 *기울임*, _밑줄식_ 그리고 `code`\n둘째 줄");
    expect(html).toContain("<h2>제목</h2>");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain("<em>기울임</em>");
    expect(html).toContain("<em>밑줄식</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toMatch(/<p>[^]*둘째 줄<\/p>/);
  });

  it("does not treat arithmetic asterisks or snake_case as emphasis", () => {
    const html = renderInline("a * b * c, 2 ** 3, sys_stdin_read, a*b*c");
    expect(html).not.toContain("<em>");
    expect(html).not.toContain("<strong>");
  });

  it("keeps markdown syntax inside inline code literal", () => {
    expect(renderInline("`**not bold**`")).toBe("<code>**not bold**</code>");
    expect(renderInline("``a ` b``")).toBe("<code>a ` b</code>");
  });

  it("renders ```python run blocks as runnable and ```js compare as a comparison box", () => {
    const html = renderMarkdown('```python run\nprint(1)\n```\n\n```js compare\n"1" + 2\n```');
    expect(html).toContain('<div class="md-run"><pre class="md-code"><code class="language-python">print(1)</code></pre></div>');
    expect(html).toContain('<div class="md-compare"><div class="md-compare-title">JavaScript와 비교</div>');
    expect(html).toContain("&quot;1&quot; + 2");
  });

  it("plain python blocks are not runnable", () => {
    const html = renderMarkdown("```python\nx = 1\n```");
    expect(html).not.toContain("md-run");
    expect(html).toContain('<pre class="md-code"><code class="language-python">x = 1</code></pre>');
  });

  it("preserves code indentation and blank lines", () => {
    const html = renderMarkdown("```python\ndef f():\n    return 1\n\nprint(f())\n```");
    expect(html).toContain("def f():\n    return 1\n\nprint(f())");
  });

  it("renders unordered, ordered and nested lists", () => {
    const html = renderMarkdown("- a\n- b\n  - b1\n- c\n\n3. x\n4. y").replace(/\n/g, "");
    expect(html).toContain("<ul><li>a</li><li>b<ul><li>b1</li></ul></li><li>c</li></ul>");
    expect(html).toContain('<ol start="3"><li>x</li><li>y</li></ol>');
  });

  it("renders blockquotes recursively", () => {
    const html = renderMarkdown("> **입력**: 두 정수\n>\n> **출력**: 합");
    expect(html).toBe("<blockquote><p><strong>입력</strong>: 두 정수</p>\n<p><strong>출력</strong>: 합</p></blockquote>");
  });

  it("renders tables with alignment and escaped pipes", () => {
    const html = renderMarkdown("| # | 입력 | 출력 |\n|:-:|---|--:|\n| 1 | `1 2` | `3` |\n| 2 | a \\| b | `x|y` |");
    expect(html).toContain('<th style="text-align:center">#</th>');
    expect(html).toContain('<td style="text-align:right"><code>3</code></td>');
    expect(html).toContain("<td>a | b</td>");
    expect(html).toContain("<code>x|y</code>");
  });

  it("renders horizontal rules and hard breaks", () => {
    expect(renderMarkdown("a\n\n---\n\nb")).toBe("<p>a</p>\n<hr>\n<p>b</p>");
    expect(renderInline("a  \nb")).toBe("a<br>\nb");
  });
});

describe("substituteNames", () => {
  it("replaces every placeholder", () => {
    expect(substituteNames("{player}! {companion}야. {player}?", { player: "하늘", companion: "누리" })).toBe("하늘! 누리야. 하늘?");
  });
});
