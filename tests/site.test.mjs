// Builds the site into a temp folder and checks what the deployed pages must guarantee:
// every language has the same pages, SEO metadata is complete and unique, links and assets resolve,
// and the languages stay in step.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, ROOT } from '../scripts/build.mjs';

let out;
let shared; // src/content/shared.json: the source of truth for how many projects and case studies exist
let pages; // [{ code, key, kind, file, href, url, html }]
const byFile = new Map();

const exists = (p) => stat(p).then(() => true, () => false);
const read = (rel) => readFile(join(out, rel), 'utf8');
const attrs = (html, tag, attr) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*?\\s${attr}="([^"]*)"`, 'g'))].map((m) => m[1]);
const meta = (html, key, value) => new RegExp(`<meta\\s+${key}="${value}"\\s+content="([^"]*)"`).exec(html)?.[1];
const ofKind = (code, kind) => pages.filter((p) => p.code === code && p.kind === kind);
const fileOf = (href) => (href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1));

before(async () => {
  shared = JSON.parse(await readFile(join(ROOT, 'src/content/shared.json'), 'utf8'));
  out = await mkdtemp(join(tmpdir(), 'portfolio-'));
  const built = await build({ outDir: out });
  pages = [];
  for (const p of built.pages) {
    const page = { ...p, html: await read(p.file) };
    pages.push(page);
    byFile.set(p.file, page);
  }
});

after(() => rm(out, { recursive: true, force: true }));

test('every language gets a home page, a projects page and one page per case study', async () => {
  for (const code of ['en', 'ar']) {
    assert.equal(ofKind(code, 'home').length, 1);
    assert.equal(ofKind(code, 'projects').length, 1);
    assert.equal(ofKind(code, 'project').length, shared.cases.length);
  }
  assert.deepEqual(
    pages.filter((p) => p.code === 'en').map((p) => p.key),
    pages.filter((p) => p.code === 'ar').map((p) => p.key),
    'the same pages in the same order in both languages',
  );
  for (const f of ['style.css', 'app.js', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'Atef_Elsaeed_CV.pdf']) {
    assert.ok(await exists(join(out, f)), `${f} is missing from the build`);
  }
});

test('shared.json is consistent: featured and case-study ids are real projects', () => {
  const ids = new Set(shared.projects.map((p) => p.id));
  for (const id of shared.home.featured) assert.ok(ids.has(id), `featured "${id}" is not in projects`);
  for (const c of shared.cases) assert.ok(ids.has(c.id), `case study "${c.id}" has no project card`);
  assert.equal(ids.size, shared.projects.length, 'duplicate project ids');
});

test('page titles and descriptions are unique across the site', () => {
  const titles = pages.map((p) => /<title>([^<]+)<\/title>/.exec(p.html)?.[1]);
  const descriptions = pages.map((p) => meta(p.html, 'name', 'description'));
  assert.equal(new Set(titles).size, pages.length, `duplicate titles: ${titles.filter((t, i) => titles.indexOf(t) !== i)}`);
  assert.equal(new Set(descriptions).size, pages.length, 'duplicate descriptions');
});

for (const lang of ['en', 'ar']) {
  test(`${lang}: language and direction are set on <html>`, () => {
    for (const p of pages.filter((x) => x.code === lang)) {
      assert.match(p.html, new RegExp(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`), p.file);
    }
  });
}

test('every page has complete SEO and social metadata', async () => {
  for (const p of pages) {
    const { html, url, file } = p;
    assert.ok((/<title>([^<]+)<\/title>/.exec(html)?.[1] ?? '').length > 10, `${file}: title`);
    assert.ok(meta(html, 'name', 'description')?.length > 60, `${file}: description`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`), `${file}: canonical`);
    assert.equal(meta(html, 'property', 'og:url'), url, `${file}: og:url`);
    assert.ok(meta(html, 'property', 'og:title') && meta(html, 'property', 'og:description'), `${file}: og text`);
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
    const image = meta(html, 'property', 'og:image');
    assert.match(image, /^https:\/\//, `${file}: og:image must be absolute`);
    assert.ok(await exists(join(out, new URL(image).pathname)), `${file}: og:image file exists`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: exactly one <h1>`);
    assert.equal(JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1])['@type'], 'Person');
  }
});

test('hreflang points every page at its translation', () => {
  for (const p of pages) {
    for (const other of pages.filter((x) => x.key === p.key)) {
      assert.match(p.html, new RegExp(`hreflang="${other.code}" href="${other.url}"`), `${p.file} -> ${other.code}`);
    }
    const defaultPage = pages.find((x) => x.key === p.key && x.code === 'en');
    assert.match(p.html, new RegExp(`hreflang="x-default" href="${defaultPage.url}"`), `${p.file}: x-default`);
    const switcher = /<a class="lang-btn" href="([^"]+)"/.exec(p.html)[1];
    const target = pages.find((x) => x.key === p.key && x.code !== p.code);
    assert.equal(switcher, target.href, `${p.file}: language button`);
  }
});

test('case studies get their own share image; every other page uses the default one', async () => {
  for (const p of pages) {
    const image = meta(p.html, 'property', 'og:image');
    const expected = p.kind === 'project' ? `${new URL(p.url).origin}/og/${p.key.split(':')[1]}.png` : `${new URL(p.url).origin}/og-image.png`;
    assert.equal(image, expected, p.file);
  }
  for (const c of shared.cases) assert.ok(await exists(join(out, 'og', `${c.id}.png`)), `run: python3 scripts/make-og.py (no og/${c.id}.png)`);
});

test('BreadcrumbList structured data: Home > Projects > case study, never on the home page', () => {
  for (const p of pages) {
    const blocks = [...p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList');
    if (p.kind === 'home') { assert.equal(crumbs, undefined, `${p.file}: no breadcrumbs on the home page`); continue; }
    const items = crumbs.itemListElement;
    assert.equal(items.length, p.kind === 'project' ? 3 : 2, p.file);
    items.forEach((it, i) => assert.equal(it.position, i + 1));
    assert.equal(items.at(-1).item, p.url, `${p.file}: the last crumb is the page itself`);
    for (const it of items) assert.ok(byFile.has(fileOf(new URL(it.item).pathname)), `${p.file}: crumb ${it.item} is not a built page`);
  }
});

test('case studies link to the previous and next one, and the links form a loop', () => {
  for (const code of ['en', 'ar']) {
    const studies = ofKind(code, 'project');
    studies.forEach((p, i) => {
      const prev = studies[(i - 1 + studies.length) % studies.length];
      const next = studies[(i + 1) % studies.length];
      assert.ok(p.html.includes(`class="case-nav-link prev" href="${prev.href}"`), `${p.file}: previous`);
      assert.ok(p.html.includes(`class="case-nav-link next" href="${next.href}"`), `${p.file}: next`);
    });
  }
});

test('404.html uses the site layout, is not indexed and leads back to the site', async () => {
  const html = await read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!html.includes('rel="canonical"'), 'a 404 page must not declare a canonical URL');
  assert.match(html, /<link rel="stylesheet" href="\/style\.css">/, 'styled from any folder depth');
  for (const href of ['/', '/projects/', '/ar.html']) assert.ok(html.includes(`href="${href}"`), `404 links to ${href}`);
  assert.match(html, /localStorage\.getItem\("ae-theme"\)/, 'applies the saved theme');
  assert.ok(!html.includes('class="active"'), 'no nav item is marked as the current page');
  assert.ok(!(await read('sitemap.xml')).includes('404'), '404 is not in the sitemap');
});

test('ids are unique and every #anchor on a page has a target', () => {
  for (const p of pages) {
    const ids = attrs(p.html, '[a-z0-9]+', 'id');
    assert.equal(new Set(ids).size, ids.length, `${p.file}: duplicate ids ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
    for (const href of attrs(p.html, 'a', 'href').filter((h) => h.startsWith('#'))) {
      assert.ok(ids.includes(href.slice(1)), `${p.file}: ${href} points at nothing`);
    }
  }
});

test('internal links lead to a built page, and #fragments exist on it', async () => {
  let checked = 0;
  for (const p of pages) {
    for (const href of attrs(p.html, 'a', 'href').filter((h) => h.startsWith('/') && !h.startsWith('//'))) {
      const [path, fragment] = href.split('#');
      const file = fileOf(path.split('?')[0]);
      assert.ok(await exists(join(out, file)), `${p.file}: ${href} leads nowhere`);
      if (fragment) assert.ok(byFile.get(file)?.html.includes(`id="${fragment}"`), `${p.file}: ${href} has no #${fragment} target`);
      checked++;
    }
  }
  assert.ok(checked > 100, 'found the internal links');
});

test('local files referenced by pages exist', async () => {
  for (const p of pages) {
    const refs = [...attrs(p.html, '[a-z]+', 'src'), ...attrs(p.html, 'link', 'href')]
      .filter((r) => r && !/^(https?:|mailto:|tel:|#|data:|\/\/)/.test(r))
      .map((r) => r.split(/[?#]/)[0]);
    for (const r of refs) assert.ok(r.startsWith('/'), `${p.file}: ${r} must be root-relative so it works from any folder`);
    for (const r of refs) assert.ok(await exists(join(out, fileOf(r))), `${p.file}: ${r} is referenced but not in the build`);
  }
});

test('images have alt text, external links open safely', () => {
  for (const p of pages) {
    for (const img of p.html.match(/<img\b[^>]*>/g) ?? []) assert.match(img, /\salt="[^"]+"/, `${p.file}: no alt on ${img.slice(0, 80)}`);
    for (const a of p.html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) assert.match(a, /rel="noopener"/, `${p.file}: no rel on ${a.slice(0, 80)}`);
  }
});

test('basics that keep pages stable and accessible: image sizes, heading order, theme colour', () => {
  for (const p of pages) {
    for (const img of p.html.match(/<img\b[^>]*>/g) ?? []) {
      assert.match(img, /\swidth="\d+"/, `${p.file}: image without width (layout shift): ${img.slice(0, 70)}`);
      assert.match(img, /\sheight="\d+"/, `${p.file}: image without height (layout shift): ${img.slice(0, 70)}`);
    }
    const levels = [...p.html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    levels.forEach((level, i) => {
      if (i > 0) assert.ok(level - levels[i - 1] <= 1, `${p.file}: heading jumps from h${levels[i - 1]} to h${level}`);
    });
    assert.match(p.html, /<meta name="theme-color"/, `${p.file}: theme-color`);
  }
});

test('home: four featured projects, each with its links, and a way to the full list', () => {
  for (const code of ['en', 'ar']) {
    const [home] = ofKind(code, 'home');
    const featured = shared.home.featured.map((id) => shared.projects.find((p) => p.id === id));
    assert.equal((home.html.match(/<article class="feature/g) || []).length, featured.length);
    assert.ok(home.html.includes(`href="${ofKind(code, 'projects')[0].href}"`), `${code}: link to all projects`);
    assert.ok(!home.html.includes('id="projects"'), 'the full grid lives on the projects page');
    const withStudy = featured.filter((p) => shared.cases.some((c) => c.id === p.id)).length;
    assert.equal((home.html.match(/class="card-link"/g) || []).length, withStudy, `${code}: featured projects with a case study are clickable`);
    assert.equal((home.html.match(/class="thumb"/g) || []).length, featured.filter((p) => p.thumb).length, `${code}: thumbnails for projects with screenshots`);
  }
});

test('projects page: every project is a pre-rendered card, and case studies are linked', () => {
  for (const code of ['en', 'ar']) {
    const [list] = ofKind(code, 'projects');
    const cards = list.html.match(/<div class="card"/g) || [];
    const total = shared.projects.length;
    assert.equal(cards.length, total, `${code}: all projects are in the HTML, not built by script`);
    const filterCounts = [...list.html.matchAll(/class="n">(\d+)</g)].map((m) => Number(m[1]));
    assert.equal(filterCounts[0], total);
    assert.equal(filterCounts.slice(1).reduce((a, b) => a + b, 0), total, 'category counts add up');
    for (const study of ofKind(code, 'project')) assert.ok(list.html.includes(`class="card-link" href="${study.href}"`), `${code}: ${study.href} is linked from its card title`);
    assert.equal((list.html.match(/class="card-link"/g) || []).length, shared.cases.length);
  }
});

test('case-study pages: full content, breadcrumb and a way back', () => {
  for (const study of pages.filter((p) => p.kind === 'project')) {
    assert.match(study.html, /<article class="case"/, study.file);
    assert.match(study.html, /class="crumbs"/, study.file);
    assert.match(study.html, /class="cta-band"/, study.file);
    assert.ok((study.html.match(/<dt>/g) || []).length >= 3, `${study.file}: summary and details are all shown`);
    assert.ok(!study.html.includes('<details'), `${study.file}: nothing hidden behind a toggle`);
  }
});

test('client data (window.SITE) carries what the scripts need', () => {
  for (const p of pages) {
    const data = JSON.parse(/window\.SITE = (\{[\s\S]*?\});<\/script>/.exec(p.html)[1]);
    assert.ok(data.all && data.words.length > 1 && data.strings.needName && data.strings.caseStudy, p.file);
    assert.ok(data.contact.wa && data.contact.email, p.file);
    for (const href of Object.values(data.cases)) assert.ok(byFile.has(fileOf(href)), `${p.file}: case link ${href}`);
    assert.equal(Object.keys(data.cases).length, shared.cases.length);
  }
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
  assert.deepEqual(shape(ar), shape(en));
});

test('the generated sitemap lists every page with its translations', async () => {
  const sitemap = await read('sitemap.xml');
  for (const p of pages) {
    assert.ok(sitemap.includes(`<loc>${p.url}</loc>`), `${p.url} missing from sitemap.xml`);
    for (const other of pages.filter((x) => x.key === p.key)) {
      assert.ok(sitemap.includes(`hreflang="${other.code}" href="${other.url}"`), `${p.url}: alternate ${other.code}`);
    }
  }
  assert.equal((sitemap.match(/<url>/g) || []).length, pages.length);
});

test('the build is deterministic', async () => {
  const again = await mkdtemp(join(tmpdir(), 'portfolio-again-'));
  try {
    await build({ outDir: again });
    for (const f of [...pages.map((p) => p.file), 'style.css', 'app.js', 'sitemap.xml']) {
      assert.equal(await readFile(join(again, f), 'utf8'), await read(f), `${f} differs between two builds`);
    }
  } finally {
    await rm(again, { recursive: true, force: true });
  }
});
