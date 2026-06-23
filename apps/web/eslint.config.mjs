// Next 16 ships eslint-config-next as a native ESLint flat config
// (Linter.Config[]). No more FlatCompat / compat.extends — import the array
// directly and spread it (wrapping it in FlatCompat throws a circular-JSON error).
import next from 'eslint-config-next';

const eslintConfig = [
  ...next,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
