// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeKatex, { output: 'htmlAndMathml' }]
      ],
    })
  ],
  redirects: {
    // 6章と7章を入れ替えた際にファイル名も変更したため、旧URLから新URLへ転送する
    '/blog/research/research-notes/circle_7_othertools': '/blog/research/research-notes/circle_6_tools',
    '/blog/research/research-notes/circle_6_cli': '/blog/research/research-notes/circle_7_cli',
  }
});