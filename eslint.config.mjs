import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import markdownlintPlugin from 'eslint-plugin-markdownlint';
import markdownlintPluginParser from 'eslint-plugin-markdownlint/parser.js';
import prettier from 'eslint-plugin-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  globalIgnores(['**/out', '**/dist', '**/*.d.ts']),
  // TypeScript and Module JavaScript files
  {
    files: ['**/*.ts', '**/*.mjs'],
    // prettier/recommended also uses eslint-config-prettier under the hood to
    // turn off all rules that might conflict with Prettier
    extends: compat.extends('plugin:prettier/recommended'),

    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 6,
      sourceType: 'module',
    },

    rules: {
      'prettier/prettier': [
        'error',
        {},
        {
          usePrettierrc: true,
        },
      ],
    },
  },

  // Markdown files.
  // The eslint markdownlint plugin (https://github.com/paweldrozd/eslint-plugin-markdownlint)
  // runs markdownlint rules (https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md).
  {
    files: ['**/*.md'],

    plugins: { markdownlint: markdownlintPlugin },
    languageOptions: { parser: markdownlintPluginParser },
    rules: {
      // Enforce a space inbetween a heading hash and the heading text (MD018)
      'markdownlint/md018': 'error',
      // Enforce that headings don't have multiple spaces between the hash and the heading text (MD019)
      'markdownlint/md019': 'error',
      // Enforce that each heading must be unique - no duplicate headings (MD024)
      'markdownlint/md024': 'error',
      // Enforce that ordered lists increment correctly (MD029)
      'markdownlint/md029': ['error', { style: 'ordered' }],
      // Enforce a space between a list marker (e.g. '-', '1.') and the list item text (MD030)
      'markdownlint/md030': 'error',
      // Enforce that code blocks use the fenced style instead of indented style (MD046)
      'markdownlint/md046': ['error', { style: 'fenced' }],
      // Enforce code block fences to use backticks (MD048)
      'markdownlint/md048': ['error', { style: 'backtick' }],
      // Enforce single asterisks for emphasis (italics) (MD049)
      'markdownlint/md049': ['error', { style: 'asterisk' }],
      // Enforce double asterisks for strong emphasis (bold) (MD050)
      'markdownlint/md050': ['error', { style: 'asterisk' }],
      // Enforce that link text should be descriptive (prevents "click here", "here", etc.) (MD059)
      'markdownlint/md059': 'error',
    },
  },
]);
