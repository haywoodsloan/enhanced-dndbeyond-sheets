import { configDefaults, defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [vue(), WxtVitest()],
  test: {
    // happy-dom gives component tests a DOM to mount into.
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    // The e2e/ suite is Playwright (a real browser), not vitest — keep it out.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
