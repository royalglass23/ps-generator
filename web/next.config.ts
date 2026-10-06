import type { NextConfig } from "next";
import { parseWordPressEmbedOrigin } from "./src/lib/config";

function frameAncestors(): string {
  const configured = parseWordPressEmbedOrigin(process.env.WORDPRESS_EMBED_ORIGIN);
  if (!configured) return "'self'";
  return `'self' ${configured}`;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{
        key: "Content-Security-Policy",
        value: `frame-ancestors ${frameAncestors()}`,
      }],
    }];
  },
};

export default nextConfig;
