import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// id: "<lang>/<yyyy-mm-dd>-<slug>"
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({ title: z.string(), date: z.coerce.date() }),
});

// id: "<lang>/<section>/<name>"
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({ title: z.string(), updated: z.coerce.date() }),
});

export const collections = { posts, pages };
