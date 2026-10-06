import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Model benchmark (task 3.4): calls OpenRouter for real and costs money. Not part of `pnpm test`.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env.local'));
} catch {
  // No .env.local: the benchmark skips itself.
}

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['scripts/**/*.test.ts'],
    testTimeout: 60 * 60_000,
    fileParallelism: false,
  },
});
