// Tiny, dependency-free Markdown → HTML renderer for SKILL.md previews.
// Escapes HTML first, then applies a safe subset (headings, lists, code,
// bold, inline code, links). Links render as data-href spans handled by the
// caller (opened via the opener plugin), never as live navigation.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  // s is already HTML-escaped
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a data-href="$2">$1</a>');
}

export function renderMarkdown(md: string): string {
  // drop image/badge markdown (decorative, often CI badges) and HTML comments
  md = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line.trim())) {
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(esc(lines[i]));
        i++;
      }
      i++; // closing fence
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = Math.min(h[1].length + 1, 5);
      out.push(`<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`);
      i++;
      continue;
    }

    const li = line.match(/^\s*[-*+]\s+(.*)$/);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(esc(li[1]))}</li>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    closeList();
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|```|\s*[-*+]\s)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(esc(buf.join(" ")))}</p>`);
  }

  closeList();
  return out.join("\n");
}
