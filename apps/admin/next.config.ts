import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@mirror/schemas'],
  // Monorepo: trace workspace deps from repo root (see Next.js outputFileTracing docs).
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
