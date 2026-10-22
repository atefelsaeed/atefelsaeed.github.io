import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, merge, TemplateError } from '../scripts/lib/template.mjs';

const render = (src, data, partials = {}, icons = {}) => createEngine({ partials, icons }).renderString(src, data);

test('{{x}} escapes HTML, {{{x}}} does not', () => {
  const data = { x: '<b>"a" & b</b>' };
  assert.equal(render('{{x}}', data), '&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;');
  assert.equal(render('{{{x}}}', data), '<b>"a" & b</b>');
});

test('a missing value is a build error, not an empty string', () => {
  assert.throws(() => render('{{nope}}', {}), TemplateError);
  assert.throws(() => render('{{a.b}}', { a: {} }), /Missing "a.b"/);
});

test('#if / else, and empty lists are falsy', () => {
  assert.equal(render('{{#if a}}yes{{else}}no{{/if}}', { a: true }), 'yes');
  assert.equal(render('{{#if a}}yes{{else}}no{{/if}}', { a: [] }), 'no');
  assert.equal(render('{{#if a}}yes{{else}}no{{/if}}', {}), 'no');
});

test('#each exposes this, @index, @first and @last', () => {
  const out = render('{{#each l}}{{@index}}{{this}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}} {{/each}}', { l: ['a', 'b', 'c'] });
  assert.equal(out, '0aF 1b 2cL ');
});

test('a name is looked up on the current item only; @root reaches the page', () => {
  const data = { rtl: true, c: 'page-level', rows: [{ t: 'parent', c: [{ t: 'leaf' }] }] };
  const out = render('{{#each rows}}{{t}}{{#each c}}[{{t}}{{#if c}}!{{/if}}{{#if @root.rtl}}R{{/if}}{{@root.c}}]{{/each}}{{/each}}', data);
  assert.equal(out, 'parent[leafRpage-level]');
  assert.throws(() => render('{{#each rows}}{{rtl}}{{/each}}', data), /Missing "rtl"/);
});

test('#with narrows the context; partials see the current context', () => {
  const partials = { 'p/item': '<{{t}}>' };
  assert.equal(render('{{#with a}}{{> p/item}}{{/with}}', { a: { t: 'x' } }, partials), '<x>');
});

test('partials can call themselves, with a depth limit', () => {
  const partials = { node: '({{t}}{{#if c}}{{#each c}}{{> node}}{{/each}}{{/if}})' };
  assert.equal(render('{{> node}}', { t: 'a', c: [{ t: 'b', c: [{ t: 'c' }] }] }, partials), '(a(b(c)))');
  assert.throws(() => render('{{> loop}}', {}, { loop: '{{> loop}}' }), /nest too deeply/);
});

test('{{svg}} takes an icon name from data or a fixed name', () => {
  const icons = { moon: '<svg id="m"/>' };
  assert.equal(render('{{svg icon}}|{{svg "moon"}}', { icon: 'moon' }, {}, icons), '<svg id="m"/>|<svg id="m"/>');
  assert.throws(() => render('{{svg "sun"}}', {}, {}, icons), /No icon "sun"/);
});

test('{{@json}} output is safe inside a <script> element', () => {
  const out = render('{{@json v}}', { v: { s: '</script><!--', n: 1 } });
  assert.ok(!out.includes('</script>'));
  assert.deepEqual(JSON.parse(out), { s: '</script><!--', n: 1 });
});

test('unbalanced or unknown tags fail loudly', () => {
  assert.throws(() => render('{{#if a}}x', { a: 1 }), /Unclosed/);
  assert.throws(() => render('x{{/if}}', {}), /Unexpected/);
  assert.throws(() => render('{{ a b }}', {}), /Cannot parse/);
});

test('merge: objects by key, lists by position, null keeps the shared entry', () => {
  const shared = { a: { x: 1 }, l: [{ id: 'one', url: 'u1' }, { id: 'two', url: 'u2' }] };
  const lang = { a: { y: 2 }, l: [{ id: 'one', label: 'L1' }, null] };
  assert.deepEqual(merge(shared, lang), { a: { x: 1, y: 2 }, l: [{ id: 'one', url: 'u1', label: 'L1' }, { id: 'two', url: 'u2' }] });
});

test('merge: entries that carry an id must line up between shared.json and a language file', () => {
  assert.throws(() => merge({ l: [{ id: 'a' }] }, { l: [{ id: 'b' }] }), /does not line up/);
});
