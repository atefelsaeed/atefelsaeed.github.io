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

## About this site

A static site with no framework and no build step, hosted on GitHub Pages.

| File | Purpose |
| --- | --- |
| `index.html` | English page |
| `ar.html` | Arabic page (right-to-left) |
| `style.css` | Shared styles, light and dark themes, RTL rules |
| `app.js` | Shared behavior: project filter, animations, theme toggle, contact form |
| `Atef_Elsaeed_CV.pdf` | Downloadable CV |

Each page sets its own text for the projects list and other dynamic parts in `window.SITE`, and `app.js` renders them, so both languages share one script.

Features: light and dark mode, filterable projects, scroll animations that respect reduced-motion settings, and a contact form that opens email or WhatsApp with the message filled in.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
