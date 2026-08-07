import js from '@eslint/js';

/**
 * domx ships to browsers as plain ES modules with no build-time transform
 * beyond bundling, so the only globals available are the DOM ones it actually
 * uses. Listing them explicitly is what makes no-undef useful here: a typo'd
 * DOM API is otherwise indistinguishable from an intended global.
 */
const browserGlobals = {
  document: 'readonly',
  window: 'readonly',
  localStorage: 'readonly',
  fetch: 'readonly',
  MutationObserver: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  CustomEvent: 'readonly',
  // Provided by the host page when the htmx extension is used
  htmx: 'readonly'
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      // Dispatch-table values share one signature, so some arms legitimately
      // ignore an argument the others use.
      'no-unused-vars': ['error', { args: 'none' }]
    }
  }
];
