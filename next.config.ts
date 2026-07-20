import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Avoid picking parent-folder lockfile when multiple exist on the machine */
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/*": ["./templates/**/*.docx", "./templates/**/*.json"],
  },
  async redirects() {
    return [{ source: "/konfigurimet", destination: "/konfigurime", permanent: true }];
  },
  /**
   * Dev-only: webpack’s persistent cache + interrupted builds often leaves stale chunk IDs
   * (`Cannot find module './611.js'`) and missing CSS chunks (unstyled HTML). Disable
   * filesystem cache in development. After `npm run build`, restart dev with `npm run dev:clean`.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
