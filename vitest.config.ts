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
    coverage: {
      provider: 'v8',
      // Terminal summary + full per-file table, a browsable HTML report at
      // coverage/index.html, and coverage/lcov.info for editors (Coverage
      // Gutters) and CI services.
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Measure the app source (under src/); leave out type-only files and HTML shells.
      include: ['src/**'],
      exclude: ['**/*.d.ts', '**/*.html', 'src/services/dndbeyond/api-types.ts'],
      // Fail the coverage run if it regresses below these floors. Kept a little
      // under the current numbers so ordinary churn doesn't trip them, but a real
      // drop does.
      thresholds: {
        statements: 94,
        branches: 87,
        functions: 94,
        lines: 94,
      },
    },
  },
});
