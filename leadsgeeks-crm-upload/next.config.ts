import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal, fully authenticated app: every page depends on the signed-in user,
  // so the classic per-request rendering model is simpler than Cache Components.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
