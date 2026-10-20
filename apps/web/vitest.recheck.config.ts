import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Dry run over saved hands (task 5.1c-6a-fix): reads the real database, writes nothing.
// Not part of `pnpm test`; run with `pnpm recheck:results`.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env.local'));
} catch {
  // No .env.local: the script skips itself.
}

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['scripts/recheck-results.test.ts'],
    testTimeout: 10 * 60_000,
    fileParallelism: false,
  },
});
