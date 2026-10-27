#!/usr/bin/env node
// Builds the site into dist/:  src/content/*.json + src/templates/** -> HTML pages for every language,
// src/css/*.css -> style.css, src/js/*.js -> app.js, public/** copied as is, sitemap.xml generated.
//
//   node scripts/build.mjs [--out dist]
//
// Pages per language: home, /projects/ and one /projects/<id>/ page for every entry in "cases".

import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, merge } from './lib/template.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The first language is the default one. Adding a language = a new src/content/<code>.json and an entry here.
const LANGUAGES = ['en', 'ar'];
// Stylesheets and scripts are concatenated in this order (later rules override earlier ones).
const CSS_FILES = ['tokens', 'base', 'main'];
const JS_FILES = ['projects', 'theme', 'main', 'contact'];

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function loadTemplates() {
  const base = join(ROOT, 'src/templates');
  const partials = {};
  const icons = {};
  let layout = '';
  for (const file of await walk(base)) {
    const rel = relative(base, file).split(sep).join('/');
    const text = await readFile(file, 'utf8');
    if (rel === 'layout.html') layout = text;
    else if (rel.endsWith('.html')) partials[rel.slice(0, -'.html'.length)] = text.replace(/\n$/, '');
    else if (rel.startsWith('icons/') && rel.endsWith('.svg')) icons[rel.slice('icons/'.length, -'.svg'.length)] = text.trim();
  }
  return { layout, partials, icons };
}

const encodeQuery = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const hrefOf = (file) => '/' + file.replace(/index\.html$/, '');

// Every page of one language: { key, kind, file, href, url }. The same key in another language is its translation.
function describePages(data, origin) {
  const { base, file } = data.page;
  const pages = [
    { key: 'home', kind: 'home', file },
    { key: 'projects', kind: 'projects', file: `${base}projects/index.html` },
    { key: 'experience', kind: 'experience', file: `${base}experience/index.html` },
    { key: 'blog', kind: 'blog', file: `${base}blog/index.html` },
    ...data.cases.map((c) => ({ key: `project:${c.id}`, kind: 'project', slug: c.id, file: `${base}projects/${c.id}/index.html` })),
  ];
  return pages.map((p) => ({ ...p, code: data.page.code, href: hrefOf(p.file), url: origin + hrefOf(p.file) }));
}

// Language-level data: shared + language file, with the lists the templates need already resolved.
function languageData(shared, langs, code) {
  const data = merge(shared, langs[code]);
  data.contact.waUrl = `https://wa.me/${data.contact.wa}?text=${encodeQuery(data.contact.waText)}`;

  const caseIds = new Set(data.cases.map((c) => c.id));
  data.projects = data.projects.map((p) => {
    const item = { ...p };
    if (caseIds.has(p.id)) item.href = `/${data.page.base}projects/${p.id}/`;
    item.hasLinks = Boolean(item.href || item.links?.length);
    for (const l of item.links ?? []) {
      if (!l?.label || !l?.url) throw new Error(`Project "${p.id}" has a link without a label or url`);
    }
    return item;
  });
  const byId = new Map(data.projects.map((p) => [p.id, p]));
  data.featured = data.home.featured.map((id) => {
    if (!byId.has(id)) throw new Error(`home.featured lists "${id}", which is not in projects`);
    return byId.get(id);
  });

  const counts = new Map();
  for (const p of data.projects) counts.set(p.c, (counts.get(p.c) ?? 0) + 1);
  data.homePosts = data.blog.posts.slice(0, 3); // the home page shows the first three; /blog/ lists all
  data.categories = [
    { name: data.app.all, count: data.projects.length, active: true },
    ...[...counts].map(([name, count]) => ({ name, count, active: false })),
  ];
  data.clientData = {
    all: data.app.all,
    words: data.app.words,
    strings: data.app.strings,
    contact: { email: data.contact.email, wa: data.contact.wa },
    cases: Object.fromEntries(data.cases.map((c) => [c.id, `/${data.page.base}projects/${c.id}/`])),
  };
  return data;
}

// The nav item (by its "page") that a page belongs to; case studies belong to Projects.
const NAV_PAGE = { projects: 'projects', project: 'projects', experience: 'experience', blog: 'blog' };

function navLinks(data, page) {
  return data.nav.links.map((l) => {
    let href;
    if (page.kind === 'home') href = `#${l.id}`;
    else if (l.page) href = `/${data.page.base}${l.page}/`;
    else if (l.id === 'top') href = data.page.home;
    else href = `${data.page.home}#${l.id}`;
    return { ...l, href, active: Boolean(l.page) && NAV_PAGE[page.kind] === l.page };
  });
}

function pageContext(data, langs, byKey, page) {
  const ctx = { ...data };
  const alternates = LANGUAGES.map((code) => byKey.get(page.key).get(code));
  const other = alternates.find((a) => a.code !== page.code);
  ctx.page = { ...data.page, kind: page.kind, url: page.url, href: page.href, indexable: true, projectsHref: `/${data.page.base}projects/`, experienceHref: `/${data.page.base}experience/`, blogHref: `/${data.page.base}blog/`, skip: page.kind === 'home' ? 'about' : 'top' };
  ctx.alternates = alternates.map(({ code, url }) => ({ code, url }));
  ctx.defaultUrl = alternates[0].url;
  ctx.otherLang = other ? { code: other.code, name: langs[other.code].page.name, href: other.href } : null;
  const links = navLinks(data, page);
  ctx.nav = { ...data.nav, links, brandHref: links[0].href, hireHref: page.kind === 'home' ? '#contact' : `${data.page.home}#contact` };

  const defaultImage = `${data.site.origin}/${data.files.ogImage}`;
  if (page.kind === 'home') {
    ctx.seo = { title: data.meta.title, description: data.meta.description, ogTitle: data.meta.ogTitle, ogDescription: data.meta.ogDescription, image: defaultImage };
  } else if (page.kind === 'projects' || page.kind === 'experience' || page.kind === 'blog') {
    const p = data[`${page.kind}Page`];
    ctx.seo = { title: p.seoTitle, description: p.seoDescription, ogTitle: p.seoTitle, ogDescription: p.seoDescription, image: defaultImage };
  } else {
    const c = data.cases.find((x) => x.id === page.slug);
    ctx.case = { ...c, template: `cases/${c.id}` };
    ctx.seo = { title: c.seo.title, description: c.seo.description, ogTitle: c.seo.title, ogDescription: c.seo.description, image: `${data.site.origin}/og/${c.id}.png` };
    const at = data.cases.indexOf(c);
    const link = (x) => ({ title: x.title, href: `/${data.page.base}projects/${x.id}/` });
    ctx.prevCase = link(data.cases[(at - 1 + data.cases.length) % data.cases.length]);
    ctx.nextCase = link(data.cases[(at + 1) % data.cases.length]);
  }
  ctx.breadcrumbs = breadcrumbs(ctx, page, data.site.origin);
  return ctx;
}

// BreadcrumbList for search results: Home > Projects > (case study).
function breadcrumbs(data, page, origin) {
  if (page.kind === 'home') return null;
  const section = data.nav.links.find((l) => l.page === NAV_PAGE[page.kind]);
  const crumbs = [
    [data.projectPage.home, origin + data.page.home],
    [section.t, origin + `/${data.page.base}${section.page}/`],
  ];
  if (page.kind === 'project') crumbs.push([data.cases.find((c) => c.id === page.slug).title, page.url]);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

function sitemapXml(groups, lastmod) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const group of groups) {
    for (const p of group) {
      lines.push(`  <url><loc>${p.url}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}`);
      for (const a of group) lines.push(`    <xhtml:link rel="alternate" hreflang="${a.code}" href="${a.url}"/>`);
      lines.push('  </url>');
    }
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

function lastModified() {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

const concat = async (dir, names, ext) =>
  (await Promise.all(names.map(async (n) => {
    const text = await readFile(join(dir, `${n}.${ext}`), 'utf8');
    return text.endsWith('\n') ? text : text + '\n';
  }))).join('');

export async function build({ outDir = join(ROOT, 'dist') } = {}) {
  const out = resolve(outDir);
  if (ROOT === out || ROOT.startsWith(out + sep)) throw new Error(`Refusing to clean ${out}`);

  const shared = await readJson(join(ROOT, 'src/content/shared.json'));
  const langs = {};
  for (const code of LANGUAGES) langs[code] = await readJson(join(ROOT, `src/content/${code}.json`));

  const { layout, partials, icons } = await loadTemplates();
  const engine = createEngine({ partials, icons });

  const perLang = Object.fromEntries(LANGUAGES.map((code) => [code, languageData(shared, langs, code)]));
  const described = Object.fromEntries(LANGUAGES.map((code) => [code, describePages(perLang[code], shared.site.origin)]));
  const byKey = new Map();
  for (const code of LANGUAGES) {
    for (const p of described[code]) {
      if (!byKey.has(p.key)) byKey.set(p.key, new Map());
      byKey.get(p.key).set(code, p);
    }
  }
  for (const [key, versions] of byKey) {
    if (versions.size !== LANGUAGES.length) throw new Error(`Page "${key}" exists in ${[...versions.keys()]} but not in every language`);
  }

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(join(ROOT, 'public'), out, { recursive: true });

  const pages = [];
  for (const code of LANGUAGES) {
    for (const page of described[code]) {
      const ctx = pageContext(perLang[code], langs, byKey, page);
      const template = `pages/${page.kind}`;
      if (!(template in partials)) throw new Error(`Missing template src/templates/${template}.html`);
      ctx.body = engine.renderString(partials[template], ctx, template);
      const html = engine
        .renderString(layout, ctx, 'layout')
        .replace(/\n[ \t]*(?=\n)/g, ''); // drop the blank lines left behind by block tags
      if (html.includes('{{')) throw new Error(`${page.file}: unresolved "{{" in the output`);
      await mkdir(dirname(join(out, page.file)), { recursive: true });
      await writeFile(join(out, page.file), html);
      pages.push({ code, key: page.key, kind: page.kind, file: page.file, href: page.href, url: page.url });
    }
  }

  // 404.html: GitHub Pages serves it for every unknown URL, so it is not tied to one language.
  const home = perLang[LANGUAGES[0]];
  const nf = { ...home };
  nf.page = { ...home.page, kind: 'notfound', url: `${shared.site.origin}/404.html`, href: '/404.html', projectsHref: '/projects/', experienceHref: '/experience/', blogHref: '/blog/', skip: 'top' };
  nf.alternates = [];
  const otherCode = LANGUAGES.find((c) => c !== LANGUAGES[0]);
  nf.otherLang = otherCode ? { code: otherCode, name: langs[otherCode].page.name, href: described[otherCode][0].href } : null;
  const nfLinks = navLinks(home, { kind: 'notfound' });
  nf.nav = { ...home.nav, links: nfLinks, brandHref: nfLinks[0].href, hireHref: `${home.page.home}#contact` };
  nf.seo = { title: shared.notFound.seoTitle, description: shared.notFound.seoDescription, ogTitle: shared.notFound.seoTitle, ogDescription: shared.notFound.seoDescription, image: `${shared.site.origin}/${shared.files.ogImage}` };
  nf.breadcrumbs = null;
  nf.body = engine.renderString(partials['pages/notfound'], nf, 'pages/notfound');
  await writeFile(join(out, '404.html'), engine.renderString(layout, nf, 'layout').replace(/\n[ \t]*(?=\n)/g, ''));

  await writeFile(join(out, 'sitemap.xml'), sitemapXml([...byKey.values()].map((v) => [...v.values()]), lastModified()));
  await writeFile(join(out, 'style.css'), await concat(join(ROOT, 'src/css'), CSS_FILES, 'css'));
  await writeFile(join(out, 'app.js'), await concat(join(ROOT, 'src/js'), JS_FILES, 'js'));

  return { outDir: out, pages };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const outDir = i > -1 ? resolve(process.argv[i + 1]) : join(ROOT, 'dist');
  const t0 = performance.now();
  const { pages } = await build({ outDir });
  console.log(`Built ${pages.length} pages (${pages.map((p) => p.file).join(', ')}) -> ${relative(process.cwd(), outDir) || '.'} in ${Math.round(performance.now() - t0)} ms`);
}
