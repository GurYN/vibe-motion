import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow large file uploads (2GB)
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
  // Exclude the projects folder from webpack watching to prevent
  // page reloads when Remotion project files change
  webpack: (config, { dev }) => {
    if (dev) {
      // Ignore the projects folder from webpack's file watcher
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(config.watchOptions?.ignored || []),
          "**/projects/**",
          "**/node_modules/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
