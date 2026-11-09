// Markdown plugins that reproduce the HTML Hexo 5 (hexo-renderer-marked + highlight.js 10) produced,
// so the ported navy.css applies unchanged.
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import { fromHtml } from 'hast-util-from-html';
import hljs from 'highlight.js';

hljs.configure({ classPrefix: '' });

// Like hexo-util: highlight line by line, carrying the parser state over, and wrap each line in
// <span class="line">…</span><br>. (Highlighting the whole block at once colors some code differently.)
function highlightLines(source, lang) {
  let state;
  return source.replace(/\n$/, '').split('\n').flatMap((line) => {
    let children = [{ type: 'text', value: line }];
    if (lang !== 'plain') {
      const result = hljs.highlight(lang, line, true, state); // 10.x continuation API
      state = result.top;
      children = fromHtml(result.value, { fragment: true }).children;
    }
    return [{ type: 'element', tagName: 'span', properties: { className: ['line'] }, children }, { type: 'element', tagName: 'br', properties: {}, children: [] }];
  });
}

// Fenced blocks as Hexo's backtick_code_block filter saw them: raw lines with only the common
// indentation removed; language lowercased, unknown or missing -> "plain".
// Indented blocks keep no language and stay a bare <pre><code>.
export function remarkHexoCode() {
  return (tree, file) => {
    const src = String(file.value);
    const lines = src.split(/\r?\n/);
    visit(tree, 'code', (node) => {
      const { start, end } = node.position;
      if (!/^\s*(```|~~~)/.test(src.slice(start.offset, start.offset + 40))) return;
      const lang = node.lang?.toLowerCase();
      node.lang = lang && hljs.getLanguage(lang) ? lang : 'plain';
      const raw = lines.slice(start.line, end.line - 1); // positions are 1-based; drop both fence lines
      if (raw.length && !raw.some((l) => /^\s*>/.test(l))) {
        const indent = Math.min(...raw.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length));
        node.value = raw.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
      }
    });
  };
}

// Hexo slugized the HTML-escaped heading text (so "&" became "-amp-"), via hexo-util slugize
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const slug = (s) => escape(s).replace(/[\u0000-\u001f]/g, '').replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'<>,.?/]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

export function rehypeHexoMarkup() {
  return (tree) => {
    const seen = {};
    visit(tree, 'element', (node, index, parent) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const text = toString(node);
        let id = slug(text);
        if (seen[id] !== undefined) id = `${id}-${++seen[id]}`;
        else seen[id] = 0;
        node.properties = { id, className: ['article-heading'] };
        node.children = [
          el('a', { href: `#${id}`, className: ['headerlink'], title: text }),
          ...node.children,
          el('a', { className: ['article-anchor'], href: `#${id}`, ariaHidden: 'true' }),
        ];
        return 'skip';
      }
      if (node.tagName === 'a' && /^https?:\/\//.test(node.properties.href ?? '') && !node.properties.href.includes('//ansgarlin.github.io')) {
        node.properties.target = '_blank';
        node.properties.rel = ['noopener', 'external', 'nofollow', 'noreferrer'];
      }
      const code = node.tagName === 'pre' && node.children.find((c) => c.tagName === 'code');
      const langClass = code && (code.properties.className ?? []).find((c) => String(c).startsWith('language-'));
      if (langClass) {
        const lang = langClass.slice(9);
        parent.children[index] = el('figure', { className: ['highlight', lang] }, [
          el('table', {}, [el('tr', {}, [el('td', { className: ['code'] }, [el('pre', {}, highlightLines(toString(code), lang))])])]),
        ]);
        return 'skip';
      }
    });
  };
}
