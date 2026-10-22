# Atef Elsaeed — Portfolio

Personal portfolio of **Atef Elsaeed**, Senior Flutter Developer based in Cairo, Egypt.

**Live site:** [atefelsaeed.github.io](https://atefelsaeed.github.io) · [النسخة العربية](https://atefelsaeed.github.io/ar.html)

## About me

Senior Flutter Developer with 5+ years building production mobile apps in fintech, government and consumer products. Co-founder of Adrenaline Platform and Dikirnis On.

- **Sulfah** — lending app, 500K+ downloads
- **Dikirnis On** — local super-app I built solo, 2,500+ users in 5 months
- **Prime Source** — Hajj operations app, cut from 250 MB to 85 MB
- **Miqat** — free, ad-free Islamic companion app

[LinkedIn](https://www.linkedin.com/in/atefelsaeed/) · [Medium](https://medium.com/@atefelsaid3) · [CV (PDF)](https://atefelsaeed.github.io/Atef_Elsaeed_CV.pdf) · atefelsaid3@gmail.com

## How this site is built

A static site with no framework. A small Node script (no dependencies) turns JSON content and HTML templates into one page per language. GitHub Actions tests it and publishes the result to GitHub Pages.

```
src/
  content/
    shared.json      same in every language: URLs, numbers, icons, tech names, image paths
    en.json          English text
    ar.json          Arabic text
  templates/
    layout.html      <head>, page frame and scripts, written once for all languages
    sections/        hero, about, services, experience, work (+ cases/), skills, blog, contact
    partials/        nav, footer, job, tree, case-body
    icons/           inline SVG icons
  css/               tokens.css (colors, themes) · base.css (reset, nav, buttons) · main.css (sections, responsive, RTL)
  js/                theme.js · projects.js · contact.js · main.js (menu, hero, scroll effects)
public/              copied to the site root unchanged: images, CV, favicon, og-image, robots, sitemap, 404
scripts/             build.mjs (the build) · serve.mjs (dev server) · lib/template.mjs (template engine)
tests/               node:test checks that run before every deploy
```

Output goes to `dist/` (not committed). CSS and JS are concatenated in the order listed in `scripts/build.mjs`.

### Commands

Needs Node 20 or newer. There is nothing to install.

```bash
npm run dev     # build, serve http://localhost:8000 and rebuild when src/ or public/ change
npm run build   # build into dist/
npm test        # build into a temp folder and check it
```

### Who owns which data

| Where | What |
| --- | --- |
| `shared.json` | Store and repo links, contact details, social links, stats numbers, icons, skill names, image paths, project and case-study links |
| `en.json` / `ar.json` | Every sentence a visitor reads, including alt text, page titles, job descriptions and project descriptions |
| `templates/` | Markup only. Anything that depends on the language comes from the JSON |

`shared.json` and a language file are merged by key. Lists are merged by position, so an entry in `shared.json` and its translation sit at the same index, and when both carry an `id` the build checks that they match. A `null` in a language list keeps the shared entry as it is.

### Everyday changes

- **Edit text:** change it in `en.json` and `ar.json`. A test fails if one language has keys the other lacks.
- **Add a project to the "more apps" grid:** add `{ "id": "my-app", "links": [...] }` to `projects` in `shared.json`, and `{ "id": "my-app", "n", "c", "d", "m" }` at the same position in both language files.
- **Add a job:** add an object to `experience.jobs` in both language files.
- **Add a screenshot:** put the image in `public/assets/shots/`, then add `{ "src": ... }` to the case's `shots` in `shared.json` and `{ "alt": ... }` in both language files.
- **Add a language:** copy `en.json` to `<code>.json` and translate it, add the code to `LANGUAGES` in `scripts/build.mjs`, add the stylesheet rules for it if it is right-to-left, and list the new page in `public/sitemap.xml` (a test fails if it is missing). The language button in the nav links to one other language, so with three or more languages `partials/nav.html` needs a small switcher.

### Template syntax

| Tag | Meaning |
| --- | --- |
| `{{path}}` | Value, HTML-escaped. A missing value stops the build |
| `{{{path}}}` | Raw value, for strings that contain markup (the About paragraphs) |
| `{{#if path}}…{{else}}…{{/if}}` | Condition. Empty lists count as false |
| `{{#each path}}…{{/each}}` | Loop. Inside: `{{this}}`, `{{@index}}`, `{{@first}}`, `{{@last}}` |
| `{{#with path}}…{{/with}}` | Narrow the context to one object |
| `{{> folder/name}}` | Include `src/templates/folder/name.html` |
| `{{svg "moon"}}` or `{{svg icon}}` | Inline `src/templates/icons/moon.svg` |
| `{{@json path}}` | JSON that is safe inside `<script>` |
| `{{@root.path}}` | Page-level data from inside a loop, for example `{{#if @root.rtl}}` |

A name is looked up on the current item only; it never falls back to an outer item. That keeps optional keys (`kind`, `chips`, `new`) from picking up a value by accident.

## Deploying

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` to GitHub Pages on every push to `main`. Pull requests run the tests and the build without publishing.

One-time setting: **Settings → Pages → Build and deployment → Source: GitHub Actions.** Change it before the first push of this layout; the old setting serves the repository root, which no longer contains `index.html`.

The last version before this layout is tagged `pre-restructure` (`git checkout pre-restructure` to look at it).

## Features

Light and dark mode, filterable projects, scroll animations that respect reduced-motion settings, English and Arabic (right-to-left) pages, and a contact form that opens email or WhatsApp with the message filled in.
