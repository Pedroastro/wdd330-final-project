module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  globals: {
    __TMDB_ACCESS_TOKEN__: 'readonly',
    __WATCHMODE_API_KEY__: 'readonly',
    process: 'readonly',
    __dirname: 'readonly',
  },
  rules: {
    'no-console': 'warn',
    'no-empty': 'error',
    'no-undef': 'error',
    quotes: [
      'error',
      'single',
      { avoidEscape: true, allowTemplateLiterals: true },
    ],
    'no-useless-escape': 'error',
  },
};
