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
  // Don't create client/AGENTS.md (notes for AI coding assistants) on `next dev`.
  agentRules: false,
  // Next.js dev-tools "N" button: bottom-right so it does not cover the sidebar's Sign out.
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
