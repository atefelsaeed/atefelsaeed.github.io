import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter, renderMarkdown } from '../scripts/lib/markdown.mjs';

test('front matter is read and required', () => {
  assert.deepEqual(parseFrontMatter('---\ntitle: A: b\ntag: Web\n---\nBody', 'x'), { meta: { title: 'A: b', tag: 'Web' }, body: 'Body' });
  assert.throws(() => parseFrontMatter('No front matter', 'x'), /front matter/);
});

test('headings get ids and a table of contents, paragraphs and lists render', () => {
  const { html, toc, words } = renderMarkdown('## First part\n\nSome **bold** and *soft* text with `code`.\n\n- one\n- two\n\n1. a\n2. b\n\n## First part\n');
  assert.deepEqual(toc, [{ id: 'first-part', text: 'First part' }, { id: 'first-part-2', text: 'First part' }]);
  assert.match(html, /<h2 id="first-part">First part<\/h2>/);
  assert.match(html, /<p>Some <strong>bold<\/strong> and <em>soft<\/em> text with <code>code<\/code>\.<\/p>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.ok(words > 10);
});

test('code blocks are escaped and left-to-right; unclosed ones fail', () => {
  const { html } = renderMarkdown('```dart\nvar a = "<b>" && 1;\n```\n');
  assert.match(html, /<pre dir="ltr"><code class="language-dart">var a = &quot;&lt;b&gt;&quot; &amp;&amp; 1;<\/code><\/pre>/);
  assert.throws(() => renderMarkdown('```\nopen'), /never closed/);
});

test('raw HTML is escaped, external links open safely and unsafe links are refused', () => {
  const { html } = renderMarkdown('<script>alert(1)</script> [x](https://example.com) [y](/blog/)');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener">x<\/a>/);
  assert.match(html, /<a href="\/blog\/">y<\/a>/);
  assert.throws(() => renderMarkdown('[z](javascript:alert(1))'), /Unsafe/);
});
