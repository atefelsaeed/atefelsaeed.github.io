#!/usr/bin/env node
// Builds the site into dist/:  src/content/*.json + src/templates/** -> one HTML page per language,
// src/css/*.css -> style.css, src/js/*.js -> app.js, public/** copied as is.
//
//   node scripts/build.mjs [--out dist]

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

function clientProjects(projects) {
  return projects.map((p) => {
    const item = { n: p.n, c: p.c, d: p.d };
    if (p.m) item.m = p.m;
    if (p.links?.length) {
      item.l = p.links.map((l) => {
        if (!l?.label || !l?.url) throw new Error(`Project "${p.id}" has a link without a label or url`);
        return [l.label, l.url];
      });
    }
    return item;
  });
}

// Everything a template can read for one language.
function pageData(shared, langs, code) {
  const data = merge(shared, langs[code]);
  const origin = data.site.origin;
  const urlOf = (file) => (file === 'index.html' ? `${origin}/` : `${origin}/${file}`);
  const pages = LANGUAGES.map((c) => ({ code: c, file: langs[c].page.file, url: urlOf(langs[c].page.file) }));
  const other = LANGUAGES.find((c) => c !== code);
  data.pages = pages;
  data.page = { ...data.page, url: urlOf(data.page.file) };
  data.otherLang = other ? { code: other, file: langs[other].page.file, name: langs[other].page.name } : null;
  data.contact.waUrl = `https://wa.me/${data.contact.wa}?text=${encodeQuery(data.contact.waText)}`;
  data.clientData = {
    all: data.app.all,
    projects: clientProjects(data.projects),
    words: data.app.words,
    strings: data.app.strings,
    contact: { email: data.contact.email, wa: data.contact.wa },
  };
  return data;
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

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(join(ROOT, 'public'), out, { recursive: true });

  const pages = [];
  for (const code of LANGUAGES) {
    const data = pageData(shared, langs, code);
    const html = engine
      .renderString(layout, data, 'layout')
      .replace(/\n[ \t]*(?=\n)/g, ''); // drop the blank lines left behind by block tags
    if (html.includes('{{')) throw new Error(`${data.page.file}: unresolved "{{" in the output`);
    await writeFile(join(out, data.page.file), html);
    pages.push({ code, file: data.page.file, url: data.page.url });
  }

  await writeFile(join(out, 'style.css'), await concat(join(ROOT, 'src/css'), CSS_FILES, 'css'));
  await writeFile(join(out, 'app.js'), await concat(join(ROOT, 'src/js'), JS_FILES, 'js'));

  return { outDir: out, pages };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const outDir = i > -1 ? resolve(process.argv[i + 1]) : join(ROOT, 'dist');
  const t0 = performance.now();
  const { pages } = await build({ outDir });
  console.log(`Built ${pages.map((p) => p.file).join(', ')} -> ${relative(process.cwd(), outDir) || '.'} in ${Math.round(performance.now() - t0)} ms`);
}
