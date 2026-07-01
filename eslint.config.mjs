import tseslint from 'typescript-eslint';

// apps/web and apps/api each have their own eslint.config.mjs (with
// eslint-config-next / Nest-specific rules). Flat config resolves only the
// nearest single config by walking up from cwd, so lint-staged's root-level
// `eslint --fix <path>` would otherwise shadow those and choke on
// framework-specific rule names (e.g. `@next/next/no-img-element`) that this
// root config doesn't know about. Ignore their trees here so lint-staged
// falls through to running with no matching config for those paths — actual
// linting for those packages happens via `pnpm lint` (turbo run lint).
export default tseslint.config(...tseslint.configs.recommended, {
  ignores: [
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    'apps/web/**',
    'apps/api/**',
  ],
});
