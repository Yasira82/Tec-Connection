import { defineConfig } from 'vitest/config';
import path             from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include:     ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude:     ['node_modules', 'e2e', '.next'],
    // Coverage gate (Template v2) — opt-in: `npm run test:coverage`.
    // Requires devDep `@vitest/coverage-v8`. Raise thresholds as the new app
    // gains tests; 60% is the platform floor (C-41 Phase-0 gate).
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'json-summary'],
      // TEC-AUDIT-0037 — a RATCHET, not the fleet floor. Measured 13 Nov 2026: 45.6 statements ·
      // 36.4 branches · 36.5 functions · 51.3 lines, below the fleet's 60/60/60/50. Set at what
      // it passes today so it can only go up; raise each number as tests are added, until it
      // reaches the fleet floor. Never lower it to make a change pass.
      thresholds: { lines: 51, functions: 36, statements: 45, branches: 36 },
      exclude:   ['**/*.test.*', '**/*.spec.*', 'src/lib/i18n/**', 'e2e/**'],
    },
  },
  // Compile JSX the way Next does — the AUTOMATIC runtime, which needs no
  // `import React`. esbuild's default is the classic runtime, so a component
  // rendered in a test threw "React is not defined" while the identical file
  // worked in the app. Matching production here is better than adding an import
  // to every component to satisfy the test runner.
  esbuild: { jsx: 'automatic' },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // See test/server-only-stub.ts — the guard stays in the source; only the
      // resolution is stubbed, because Vitest has no bundler to enforce it.
      'server-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
});
