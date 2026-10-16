// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://damato.design',
  // Keep the previous output directory so existing deploy settings still work.
  outDir: './_site',
});
