---
title: How I built my bilingual portfolio without a framework
description: A static site in English and Arabic built by a Node script with no dependencies, and the tests that keep SEO, contrast and image weight from breaking.
tag: Web
---
My portfolio has to do three things: load fast, read well in English and in right-to-left Arabic, and be easy to change a year from now. A framework would solve some of that. I chose a 300-line build script instead, and this is what I learned.

## The shape of the site

Content lives in JSON, markup lives in HTML templates, and a Node script joins them into one page per language.

```
src/
  content/   shared.json  en.json  ar.json
  templates/ layout.html  pages/  partials/
  articles/  one folder per article, one Markdown file per language
scripts/     build.mjs  lib/template.mjs  lib/markdown.mjs
tests/       run before every deploy
```

`shared.json` holds what is the same in every language: URLs, numbers, image paths. `en.json` and `ar.json` hold every sentence a visitor reads. The build merges them by key, so a project exists once and is translated twice.

## Why not a framework

The site has no state, no accounts and no data that changes after the build. Every page can be plain HTML. A framework would add a dependency tree, a toolchain to keep updated and JavaScript the visitor does not need. The build script has no dependencies at all, so there is nothing to upgrade and `npm install` does not exist.

## Tests are what make it safe to change

A static site has no compiler to catch mistakes, so the tests do that job. They build the whole site into a temporary folder and check what must stay true:

- every page exists in both languages, with a unique title and description
- every internal link and image resolves
- the sitemap lists every page with its `hreflang` alternates
- English and Arabic files have the same keys, so nothing is left untranslated
- no image is over 300 KB or 1200 px wide

One test computes WCAG contrast ratios from the color tokens. It failed the first time: the buttons in the dark theme had 2.3:1 text contrast, far from the 4.5:1 that AA asks for. I would not have noticed by eye.

## Deploying

GitHub Actions runs the tests, builds into `dist/` and publishes it to GitHub Pages. If the tests fail, nothing is published. One thing cost me an hour: the repository's Pages source must be set to *GitHub Actions*. Left on "Deploy from branch", the site serves the repository root and shows a blank page.

## What I would do again

1. Keep content and markup apart from the first day.
2. Write the tests before the second language, not after.
3. Treat images like code: a budget, and a script that enforces it.
