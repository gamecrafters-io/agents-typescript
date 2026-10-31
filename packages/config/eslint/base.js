// @ts-check
import eslint from '@eslint/js';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';

// Packages extend this and set `tsconfigRootDir` to their own directory.
export default defineConfig(
  {ignores: ['build/', 'coverage/']},
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Destructuring a property out to leave it behind is deliberate.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {ignoreRestSiblings: true},
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
