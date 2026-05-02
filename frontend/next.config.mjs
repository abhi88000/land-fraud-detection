/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Performance optimizations
  reactStrictMode: false, // Avoid double renders in dev
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
};

export default nextConfig;
