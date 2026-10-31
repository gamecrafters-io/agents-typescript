import base from '@gamecrafters/eslint-config/base';
import {defineConfig} from 'eslint/config';

export default defineConfig(base, {
  languageOptions: {parserOptions: {tsconfigRootDir: import.meta.dirname}},
});
