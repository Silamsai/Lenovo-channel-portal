import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every page is rendered on the server for each request (per-user data), so the
  // classic dynamic rendering model is used instead of Cache Components.
  experimental: {
    serverActions: {
      // Campaign files are uploaded through server actions (25 MB per file, several per upload).
      bodySizeLimit: '110mb',
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
