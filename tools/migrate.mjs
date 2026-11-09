// One-off migration: Hexo source (+ live output for sidebars) -> Astro content.
// Usage: node tools/migrate.mjs <hexo-dir> <live-dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const [hexo, live] = process.argv.slice(2).map((p) => path.resolve(p));
const src = path.join(hexo, 'source');
const out = path.resolve('src/content');
const pub = path.resolve('public');
const SECTIONS = ['android', 'java', 'kotlin', 'material_design', 'note', 'rxjava']; // others/ and owasp/ were never published

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const gitDate = (file) => execFileSync('git', ['-C', hexo, 'log', '-1', '--format=%cs', '--', path.relative(hexo, file)]).toString().trim();

// Hexo front matter has no opening '---': "title: X\n---\nbody"
function split(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const m = raw.match(/^(?:-{3,}\r?\n)?([\s\S]*?)\r?\n-{3,}[ \t]*\r?\n([\s\S]*)$/);
  // "title:crack" (no space) was not parsed by Hexo either; fix it instead of rendering it as a heading
  return { data: YAML.parse(m[1].replace(/^(\w+):(?=\S)/gm, '$1: ')) ?? {}, body: m[2] };
}
// Astro would treat relative Markdown image paths as imports; point them at the same public URL instead
const absImages = (body, pageUrl) =>
  body.replace(/(!\[[^\]]*\]\()([^)\s]+)/g, (all, pre, url) =>
    /^([a-z]+:|\/|#)/i.test(url) ? all : pre + new URL(url, 'https://x' + pageUrl).pathname);
const fm = (data) => '---\n' + Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n---\n';

// These posts were edited after the last commit to the Hexo repo; the published HTML is newer,
// so their Markdown is recovered from the live output instead.
const LIVE_NEWER = ['en/2019-05-05-build_remotely-with_mainframer', 'zh-tw/2018-09-25-about_art_1_compilation', 'zh-tw/2018-12-13-year_end_report_2_gc_give_me_some_space_java'];
const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'indented', emDelimiter: '*' }).use(gfm);
turndown.addRule('hexo-code', {
  filter: (n) => n.nodeName === 'FIGURE' && n.classList.contains('highlight'),
  replacement: (_, n) => {
    const lang = n.classList[1] === 'plain' ? '' : n.classList[1];
    const lines = [...n.querySelectorAll('td.code .line')].map((l) => l.textContent);
    return `\n\n\`\`\`${lang}\n${lines.join('\n')}\n\`\`\`\n\n`;
  },
});
function liveMarkdown(url) {
  const html = fs.readFileSync(path.join(live, url, 'index.html'), 'utf8');
  const content = html.match(/itemprop="articleBody">([\s\S]*?)<\/div>\s*(?:<section id="comments">|<\/article>)/)[1]
    .replace(/<a href="[^"]*" class="headerlink"[^>]*><\/a>|<a class="article-anchor"[^>]*><\/a>/g, '');
  return turndown.turndown(content) + '\n';
}

// Obvious source typos that broke rendering
const PATCHES = {
  'en/2019-07-13-escape_from_crash_hell_1': [['setDataDirectorySuffix(java.lang.String) to assign', 'setDataDirectorySuffix(java.lang.String)) to assign']],
};

// Posts
let posts = 0;
for (const lang of ['en', 'zh-tw']) {
  const dir = path.join(src, '_posts', lang);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const base = f.slice(0, -3);
    const [, y, m, d, slug] = base.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
    const id = `${lang}/${base}`;
    let { data, body } = split(path.join(dir, f));
    if (LIVE_NEWER.includes(id)) body = liveMarkdown(`${lang}/news/${y}/${m}/${d}/${slug}`);
    for (const [from, to] of PATCHES[id] ?? []) body = body.replace(from, to);
    // hexo-asset-image stripped the "<asset folder>/" prefix so images resolve next to the post URL
    const fixed = absImages(body.split(`](${base}/`).join('](').split(`src="${base}/`).join('src="'), `/${lang}/news/${y}/${m}/${d}/${slug}/`);
    write(path.join(out, 'posts', lang, f), fm({ title: String(data.title ?? ""), date: `${y}-${m}-${d}` }) + fixed);
    const assets = path.join(dir, base);
    if (fs.existsSync(assets)) fs.cpSync(assets, path.join(pub, lang, 'news', y, m, d, slug), { recursive: true });
    posts++;
  }
}

// Pages
let pages = 0;
for (const lang of ['en', 'zh-tw']) {
  for (const section of SECTIONS) {
    const dir = path.join(src, lang === 'en' ? '' : lang, section);
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const file = path.join(dir, f);
      const { data, body } = split(file);
      write(path.join(out, 'pages', lang, section, f), fm({ title: String(data.title ?? ""), updated: gitDate(file) }) + absImages(body, `${lang === 'en' ? '' : '/' + lang}/${section}/${f.slice(0, -3)}.html`));
      pages++;
    }
  }
}

// Static assets
fs.cpSync(path.join(src, 'assets'), path.join(pub, 'assets'), { recursive: true });
for (const f of ['favicon.ico', 'logo.png', 'logo.svg']) fs.copyFileSync(path.join(src, f), path.join(pub, f));

// Sidebars: taken from the live output (the live labels differ from the theme's language files)
const sidebar = {};
for (const lang of ['en', 'zh-tw']) {
  for (const section of SECTIONS) {
    const html = fs.readFileSync(path.join(live, lang === 'en' ? '' : lang, section, 'index.html'), 'utf8');
    const inner = html.match(/<aside id="sidebar"[\s\S]*?<div class="inner">([\s\S]*?)<\/div>/)[1];
    const groups = [];
    for (const [, title, a] of inner.matchAll(/<strong class="sidebar-title">([^<]*)<\/strong>|<a href="([^"]*)"/g)) {
      if (title !== undefined) groups.push({ title, links: [] });
      else groups.at(-1).links.push({ href: a });
    }
    let i = 0;
    const texts = [...inner.matchAll(/class="sidebar-link[^"]*">([^<]*)<\/a>/g)].map((m) => m[1]);
    for (const g of groups) for (const l of g.links) l.text = texts[i++];
    (sidebar[lang] ??= {})[section] = groups;
  }
}
write(path.resolve('src/data/sidebar.json'), JSON.stringify(sidebar, null, 2) + '\n');
console.log({ posts, pages });
