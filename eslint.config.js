import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.husky/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Node-Skripte (Build-/Wartungs-Tools, keine Browser-Deps) — `process` & Co. sind hier global.
    files: ['scripts/**/*.{mjs,js,ts}'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
)
