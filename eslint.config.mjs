import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Shared config for packages/*. apps/web has its own Next.js config.
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'apps/**', 'legacy/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
