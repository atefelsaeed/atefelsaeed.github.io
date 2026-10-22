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
    layout.html      <head>, page frame and scripts, written once for every page
    pages/           home.html, projects.html (the full list), project.html (one case study)
    sections/        the home page sections: hero, about, services, experience, work, skills, blog, contact
    cases/           the side panel of each case study (screenshots, trees, modules), one file per case id
    partials/        nav, footer, job, tree, case-body, project cards and links
    icons/           inline SVG icons
  css/               tokens.css (colors, themes) · base.css (reset, nav, buttons) · main.css (sections, responsive, RTL)
  js/                theme.js · projects.js · contact.js · main.js (menu, hero, scroll effects)
public/              copied to the site root unchanged: images, CV, favicon, og-image, robots, 404
scripts/             build.mjs (the build) · serve.mjs (dev server) · lib/template.mjs (template engine)
tests/               node:test checks that run before every deploy
```

Output goes to `dist/` (not committed), including a generated `sitemap.xml`. CSS and JS are concatenated in the order listed in `scripts/build.mjs`.

### Pages

| Page | English | Arabic | Content |
| --- | --- | --- | --- |
| Home | `/` | `/ar.html` | Hero, about, services, experience, four featured projects, skills, blog, contact |
| All projects | `/projects/` | `/ar/projects/` | Every project as a card (rendered at build time), with the industry filter |
| Case study | `/projects/<id>/` | `/ar/projects/<id>/` | One page per entry in `cases` |

Every page knows its translation: the language button, `hreflang` links and the sitemap are generated from that.

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
- **Add a project to the list:** add `{ "id": "my-app", "links": [...] }` to `projects` in `shared.json`, and `{ "id": "my-app", "n", "c", "d", "m" }` at the same position in both language files. It shows up on `/projects/` automatically.
- **Change the featured projects on the home page:** edit `home.featured` in `shared.json` (project ids, in display order).
- **Add a case-study page:** add an entry to `cases` in `shared.json` (id, package name, store links, screenshots) and in both language files (text, `seo.title`, `seo.description`), plus the side panel `src/templates/cases/<id>.html`. Use the same id as the project, and its card on `/projects/` and on the home page gets a "Case study" link by itself.
- **Add a job:** add an object to `experience.jobs` in both language files.
- **Add a screenshot:** put the image in `public/assets/shots/`, then add `{ "src": ... }` to the case's `shots` in `shared.json` and `{ "alt": ... }` in both language files.
- **Add a language:** copy `en.json` to `<code>.json` and translate it, add the code to `LANGUAGES` in `scripts/build.mjs`, and add the stylesheet rules for it if it is right-to-left. The sitemap and `hreflang` links follow by themselves. The language button in the nav links to one other language, so with three or more languages `partials/nav.html` needs a small switcher.

### Template syntax

| Tag | Meaning |
| --- | --- |
| `{{path}}` | Value, HTML-escaped. A missing value stops the build |
| `{{{path}}}` | Raw value, for strings that contain markup (the About paragraphs) |
| `{{#if path}}…{{else}}…{{/if}}` | Condition. Empty lists count as false |
| `{{#each path}}…{{/each}}` | Loop. Inside: `{{this}}`, `{{@index}}`, `{{@first}}`, `{{@last}}` |
| `{{#with path}}…{{/with}}` | Narrow the context to one object |
| `{{> folder/name}}` | Include `src/templates/folder/name.html` |
| `{{> *path}}` | Include the partial whose name is stored in the data at `path` |
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
