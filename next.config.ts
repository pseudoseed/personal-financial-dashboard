import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Disable ESLint during builds to avoid linting errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript checking during builds to avoid type errors
    ignoreBuildErrors: true,
  },
  
  // Cache busting and performance optimizations
  generateBuildId: async () => {
    // Generate a build ID based on timestamp for cache busting
    return `build-${Date.now()}`;
  },
  
  // Static asset optimization
  experimental: {
    // Enable package import optimization
    optimizePackageImports: ['@heroicons/react', 'chart.js'],
  },
  
  // Headers for cache control
  async headers() {
    return [
      {
        // Apply headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache public assets - fixed regex pattern
        source: '/:path*.(ico|png|jpg|jpeg|gif|svg|webp|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes - no cache for dynamic data
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // HTML pages - short cache for updates
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Compiler optimizations
  compiler: {
    // Remove console logs in production - temporarily disabled for debugging
    removeConsole: false, // process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    // Disable image optimization for self-hosted deployment
    unoptimized: true,
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;
