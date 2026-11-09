import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkBreaks from 'remark-breaks';
import { remarkHexoCode, rehypeHexoMarkup } from './src/lib/markdown.mjs';

export default defineConfig({
  site: 'https://ansgarlin.github.io',
  // "preserve" keeps Hexo's mixed URL styles: /android/paint.html and /en/news/.../slug/
  build: { format: 'preserve' },
  trailingSlash: 'ignore',
  // keep inter-element whitespace like the Hexo templates (it affects inline spacing in the header/footer)
  compressHTML: false,
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      // marked's smartypants: -- is an en dash, --- an em dash
      smartypants: { dashes: 'oldschool' },
      remarkPlugins: [remarkBreaks, remarkHexoCode],
      rehypePlugins: [rehypeHexoMarkup],
    }),
  },
});
