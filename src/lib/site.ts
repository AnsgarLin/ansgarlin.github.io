import type { CollectionEntry } from 'astro:content';
import sidebars from '../data/sidebar.json';

export type Lang = 'en' | 'zh-tw';
export const LANGS: Record<Lang, string> = { en: 'English', 'zh-tw': '正體中文' };
export const SECTIONS = ['android', 'java', 'kotlin', 'material_design', 'note', 'rxjava'] as const;

export const t = {
  en: { post: 'Post', contents: 'Contents', top: 'Back to Top', prev: 'Prev', next: 'Next', updated: 'Last updated: ' },
  'zh-tw': { post: '文章', contents: '目錄', top: '回到頁首', prev: '上一頁', next: '下一頁', updated: '上次更新：' },
};

// Header menu as on the live site: "news" is shared, the sections are localized
export const menu = (lang: Lang) => {
  const p = lang === 'en' ? '' : `/${lang}`;
  return [
    { href: '/news/', text: t[lang].post },
    { href: `${p}/android/`, text: 'Android' },
    { href: `${p}/kotlin/`, text: 'Kotlin' },
    { href: `${p}/rxjava/`, text: 'RxJava' },
  ];
};

export const day = (d: Date) => d.toISOString().slice(0, 10);

export function postInfo(post: CollectionEntry<'posts'>) {
  const [lang, file] = post.id.split('/') as [Lang, string];
  const [, y, m, d, slug] = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/)!;
  return { lang, y, m, d, slug, url: `/${lang}/news/${y}/${m}/${d}/${slug}/` };
}

// Newest first; same-day posts keep their file order
export const byDateDesc = (a: CollectionEntry<'posts'>, b: CollectionEntry<'posts'>) => b.data.date.getTime() - a.data.date.getTime();

export function pageInfo(page: CollectionEntry<'pages'>) {
  const [lang, section, name] = page.id.split('/') as [Lang, string, string];
  const sidebar = (sidebars as any)[lang][section] as { title: string; links: { href: string; text: string }[] }[];
  // prev/next follow the sidebar order, de-duplicated by link (Hexo's page_nav)
  const titles = new Map<string, string>();
  for (const g of sidebar) for (const l of g.links) titles.set(l.href, l.text);
  const order = [...titles.keys()];
  const i = order.indexOf(`${name}.html`);
  const nav = (j: number) => (i >= 0 && j >= 0 && j < order.length ? { href: order[j], title: titles.get(order[j])! } : undefined);
  return { lang, section, name, canonical: `${section}/${name}.html`, sidebar, prev: nav(i - 1), next: nav(i + 1) };
}

// Hexo's toc helper markup
export function tocHtml(headings: { depth: number; slug: string; text: string }[]) {
  if (!headings.length) return '';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = '<ol class="toc">';
  const stack = [headings[0].depth];
  headings.forEach((h, i) => {
    if (i > 0) {
      const top = stack[stack.length - 1];
      if (h.depth > top) { html += '<ol class="toc-child">'; stack.push(h.depth); }
      else {
        html += '</li>';
        while (stack.length > 1 && h.depth < stack[stack.length - 1]) { stack.pop(); html += '</ol></li>'; }
      }
    }
    html += `<li class="toc-item toc-level-${h.depth}"><a class="toc-link" href="#${encodeURI(h.slug)}"><span class="toc-text">${esc(h.text)}</span></a>`;
  });
  html += '</li>' + '</ol></li>'.repeat(stack.length - 1) + '</ol>';
  return html;
}
