import tseslint from 'typescript-eslint';

// apps/web and apps/api have their own eslint.config.mjs (Next/Nest-aware).
// lint-staged runs per-package config blocks with cwd inside each package,
// so ESLint's flat-config resolution picks up the right config there — this
// root config only needs to cover the rest of the monorepo.
export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['**/dist/**', '**/.next/**', '**/coverage/**'],
});
