import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the node_modules actually
  // reached at runtime. Required by the Dockerfile; harmless in development.
  output: "standalone",

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing in this app is meant to be framed by another site.
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
