import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // poker-core ships TypeScript source; let Next compile it.
  transpilePackages: ['poker-core'],
};

export default nextConfig;
