// Builds the site into a temp folder and checks what the deployed pages must guarantee:
// both languages exist, SEO metadata is complete, links and assets resolve, and the languages stay in step.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, ROOT } from '../scripts/build.mjs';

let out;
let pages; // { en: { file, url, html }, ar: {...} }

const exists = (p) => stat(p).then(() => true, () => false);
const read = (rel) => readFile(join(out, rel), 'utf8');
const attrs = (html, tag, attr) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*?\\s${attr}="([^"]*)"`, 'g'))].map((m) => m[1]);
const meta = (html, key, value) => new RegExp(`<meta\\s+${key}="${value}"\\s+content="([^"]*)"`).exec(html)?.[1];

before(async () => {
  out = await mkdtemp(join(tmpdir(), 'portfolio-'));
  const built = await build({ outDir: out });
  pages = {};
  for (const p of built.pages) pages[p.code] = { ...p, html: await read(p.file) };
});

after(() => rm(out, { recursive: true, force: true }));

test('builds one page per language plus the shared stylesheet and script', async () => {
  assert.deepEqual(Object.keys(pages), ['en', 'ar']);
  for (const f of ['index.html', 'ar.html', 'style.css', 'app.js', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'Atef_Elsaeed_CV.pdf']) {
    assert.ok(await exists(join(out, f)), `${f} is missing from the build`);
  }
});

test('language and direction are set on <html>', () => {
  assert.match(pages.en.html, /<html lang="en" dir="ltr">/);
  assert.match(pages.ar.html, /<html lang="ar" dir="rtl">/);
});

for (const code of ['en', 'ar']) {
  test(`${code}: SEO and social metadata are complete`, async () => {
    const { html, url } = pages[code];
    assert.equal((html.match(/<title>[^<]+<\/title>/g) || []).length, 1, 'exactly one non-empty <title>');
    assert.ok(meta(html, 'name', 'description')?.length > 40, 'meta description');
    assert.equal(attrs(html, 'link', 'href').filter((h) => h === url).length >= 1, true);
    assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
    assert.equal(meta(html, 'property', 'og:url'), url);
    assert.ok(meta(html, 'property', 'og:title') && meta(html, 'property', 'og:description'), 'og title and description');
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
    const image = meta(html, 'property', 'og:image');
    assert.match(image, /^https:\/\//, 'og:image must be absolute');
    assert.ok(await exists(join(out, new URL(image).pathname)), 'og:image file exists');
    for (const l of ['en', 'ar']) assert.match(html, new RegExp(`hreflang="${l}" href="${pages[l].url}"`), `hreflang ${l}`);
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
    assert.equal(JSON.parse(ld)['@type'], 'Person');
  });

  test(`${code}: every in-page link has a target, and ids are unique`, () => {
    const { html } = pages[code];
    const ids = attrs(html, '[a-z0-9]+', 'id');
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
    for (const href of attrs(html, 'a', 'href').filter((h) => h.startsWith('#'))) {
      assert.ok(ids.includes(href.slice(1)), `${href} points at nothing`);
    }
  });

  test(`${code}: local files referenced by the page exist`, async () => {
    const { html } = pages[code];
    const refs = [...attrs(html, '[a-z]+', 'src'), ...attrs(html, '(?:a|link)', 'href')]
      .filter((r) => r && !/^(https?:|mailto:|tel:|#|data:)/.test(r))
      .map((r) => r.split(/[?#]/)[0]);
    assert.ok(refs.length > 10, 'found the local references');
    for (const r of refs) assert.ok(await exists(join(out, r)), `${r} is referenced but not in the build`);
  });

  test(`${code}: images have alt text, external links open safely`, () => {
    const { html } = pages[code];
    for (const img of html.match(/<img\b[^>]*>/g)) assert.match(img, /\salt="[^"]+"/, `no alt: ${img.slice(0, 80)}`);
    for (const a of html.match(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(a, /rel="noopener"/, `no rel: ${a.slice(0, 80)}`);
  });

  test(`${code}: client data (window.SITE) is complete`, () => {
    const data = JSON.parse(/window\.SITE = (\{[\s\S]*?\});<\/script>/.exec(pages[code].html)[1]);
    assert.ok(data.projects.length >= 10);
    for (const p of data.projects) {
      assert.ok(p.n && p.c && p.d, `project ${p.n} needs name, category and description`);
      for (const [label, url] of p.l ?? []) assert.ok(label && /^https:\/\//.test(url), `bad link on ${p.n}`);
    }
    assert.ok(data.words.length > 1 && data.strings.needName && data.contact.wa && data.contact.email);
  });
}

test('both languages have the same sections, anchors and case studies', () => {
  const sections = (html) => attrs(html, 'section', 'id');
  const cases = (html) => [...html.matchAll(/<article class="case reveal" id="([^"]+)"/g)].map((m) => m[1]);
  const navTargets = (html) => [...html.matchAll(/<li><a href="#([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(sections(pages.ar.html), sections(pages.en.html));
  assert.deepEqual(cases(pages.ar.html), cases(pages.en.html));
  assert.deepEqual(navTargets(pages.ar.html), navTargets(pages.en.html));
  assert.equal(cases(pages.en.html).length, 4);
});

test('every nav link targets a section that exists', () => {
  const html = pages.en.html;
  const ids = attrs(html, '[a-z0-9]+', 'id');
  for (const m of html.matchAll(/<li><a href="#([^"]+)">/g)) assert.ok(ids.includes(m[1]), `nav -> #${m[1]}`);
});

test('en.json and ar.json have the same structure, so nothing is left untranslated', async () => {
  const load = async (c) => JSON.parse(await readFile(join(ROOT, `src/content/${c}.json`), 'utf8'));
  const OPTIONAL = new Set(['meta.ogLocale']);
  const shape = (v, path = '') =>
    Array.isArray(v)
      ? v.map((x, i) => shape(x, `${path}[${i}]`))
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).filter((k) => !OPTIONAL.has(path ? `${path}.${k}` : k)).sort().map((k) => [k, shape(v[k], path ? `${path}.${k}` : k)]))
        : typeof v;
  const [en, ar] = [await load('en'), await load('ar')];
  // page.name and string values differ by design; only the shape must match.
  assert.deepEqual(shape(ar), shape(en));
});

test('the sitemap lists every page', async () => {
  const sitemap = await read('sitemap.xml');
  for (const { url } of Object.values(pages)) assert.ok(sitemap.includes(`<loc>${url}</loc>`), `${url} missing from sitemap.xml`);
});

test('the build is deterministic', async () => {
  const again = await mkdtemp(join(tmpdir(), 'portfolio-again-'));
  try {
    await build({ outDir: again });
    for (const f of ['index.html', 'ar.html', 'style.css', 'app.js']) {
      assert.equal(await readFile(join(again, f), 'utf8'), await read(f), `${f} differs between two builds`);
    }
  } finally {
    await rm(again, { recursive: true, force: true });
  }
});
