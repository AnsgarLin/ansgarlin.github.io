# ansgarlin.github.io

Personal blog, built with [Astro](https://astro.build) as a static site. Ported from the Hexo "navy" theme; the look and every URL are kept.

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # -> dist/
npm run preview
```

## Layout

- `src/content/posts/<lang>/<yyyy-mm-dd>-<slug>.md` → `/<lang>/news/<yyyy>/<mm>/<dd>/<slug>/` (images in `public/<lang>/news/...`)
- `src/content/pages/<lang>/<section>/<name>.md` → `/<section>/<name>.html` (en) and `/zh-tw/<section>/<name>.html`
- `src/data/sidebar.json` — sidebar groups per language and section; it also sets prev/next order
- `/news/`, `/news/<yyyy>/`, `/news/<yyyy>/<mm>/` — archives of both languages
- `src/lib/markdown.mjs` — reproduces Hexo's Markdown output (heading ids, code blocks, highlight.js 10) so `src/styles/navy.css` applies unchanged
- `tools/migrate.mjs` — the one-off Hexo → Astro migration (kept for reference)

Deployed by `.github/workflows/deploy.yml` on push to `master` (Pages source: GitHub Actions).
