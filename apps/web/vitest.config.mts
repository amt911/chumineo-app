import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      exclude: [
        '**/*.config.*', '.next/**', 'app/**', 'components/ui/**',
        'next-env.d.ts', 'vitest.setup.ts', 'coverage/**',
        // shadcn-generated cn utility — not unit-tested, covered by integration tests
        'lib/utils.ts',
        // dev launch script — infra tooling (like main.ts/seed.ts), not unit-tested
        'scripts/**',
        // App Router pages — integration-tested, excluded from unit coverage
        'app/(auth)/**',
        'app/profile/**',
      ],
    },
  },
});
