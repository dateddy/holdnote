import path from 'node:path';
import { defineConfig } from 'vitest/config';

// RLS tests hit the linked Supabase project with throwaway users. Not part of `pnpm test`.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env.local'));
} catch {
  // No .env.local: the suite skips itself.
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
