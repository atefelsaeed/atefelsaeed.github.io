// A small Markdown renderer for the articles: front matter, headings, paragraphs, lists, quotes, code blocks,
// images, and inline code, bold, italic and links. Everything else is escaped text, so an article can never inject markup.

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${escapeHtml(c)}</code>`) - 1}\u0000`);
  s = escapeHtml(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    if (!/^(https?:\/\/|mailto:|\/|#)/.test(url)) throw new Error(`Unsafe or relative link in an article: ${url}`);
    const external = /^https?:/.test(url);
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

export function parseFrontMatter(source, where) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!m) throw new Error(`${where}: an article starts with a --- front matter block`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-zA-Z]+):\s*(.+)$/.exec(line);
    if (!kv) throw new Error(`${where}: cannot read front matter line "${line}"`);
    meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: source.slice(m[0].length) };
}

// Returns { html, toc: [{ id, text }], words }.
export function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  const used = new Set();
  let words = 0;
  let i = 0;

  const count = (t) => { words += t.split(/\s+/).filter(Boolean).length; };
  const idFor = (text) => {
    let id = slugify(text) || 'section';
    for (let n = 2; used.has(id); n++) id = `${slugify(text) || 'section'}-${n}`;
    used.add(id);
    return id;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const code = [];
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) code.push(lines[i]);
      if (i >= lines.length) throw new Error('An article has a code block that is never closed');
      i++;
      out.push(`<pre dir="ltr"><code${fence[1] ? ` class="language-${fence[1]}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const id = idFor(heading[2]);
      if (level === 2) toc.push({ id, text: heading[2] });
      count(heading[2]);
      out.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) quote.push(lines[i].replace(/^>\s?/, ''));
      count(quote.join(' '));
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const list = /^(\d+\.|[-*])\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items = [];
      for (; i < lines.length && /^(\d+\.|[-*])\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^(\d+\.|[-*])\s+/, ''));
      count(items.join(' '));
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(```|#{2,3}\s|>\s?|(\d+\.|[-*])\s)/.test(lines[i]); i++) para.push(lines[i]);
    count(para.join(' '));
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc, words };
}
