import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow up to 500 MB uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // Empty turbopack config silences the webpack-config-with-turbopack warning
  turbopack: {},
  // Externalize native modules for server-side only
  serverExternalPackages: ['better-sqlite3', 'sharp'],
};

export default nextConfig;
