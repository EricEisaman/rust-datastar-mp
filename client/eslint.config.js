import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import vueParser from 'vue-eslint-parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        requestAnimationFrame: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      vue: vuePlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Vue Vapor Mode Enforcement
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vue',
              importNames: ['createApp'],
              message:
                'VUE VAPOR MODE ENFORCEMENT: createApp is forbidden. Use createVaporApp instead.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='createApp']",
          message:
            'VUE VAPOR MODE ENFORCEMENT: createApp() call is forbidden. Use createVaporApp() instead.',
        },
      ],

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Vue rules
      'vue/multi-word-component-names': 'off',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // Prettier
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  prettierConfig,
];
