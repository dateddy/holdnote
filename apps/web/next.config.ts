import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// One .env.local at the repo root serves the web app, scripts and the Supabase CLI.
// forceReload: Next has already loaded (and cached) env from apps/web by the time this runs.
loadEnvConfig(
  path.resolve(__dirname, '../..'),
  process.env.NODE_ENV !== 'production',
  undefined,
  true,
);

const nextConfig: NextConfig = {
  // poker-core ships TypeScript source; let Next compile it.
  transpilePackages: ['poker-core'],
};

export default nextConfig;
