import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Avoid picking parent-folder lockfile when multiple exist on the machine */
  outputFileTracingRoot: path.join(__dirname),
  /**
   * These asset dirs are read at runtime via process.cwd() (termination/leave/
   * contract DOCX and the ATK xlsx). Next cannot see a dynamic fs.readFile, so
   * without this they are not traced into the serverless bundle and every read
   * ENOENTs on Vercel. They are small (a handful of docx + one xlsx + json).
   * "/**" (not "/*") so nested routes like /api/largimet/[id]/document get them.
   */
  outputFileTracingIncludes: {
    // scripts/** because company provisioning loads the per-company template
    // seeders (scripts/seed-*-templates.cjs) at runtime via createRequire.
    //
    // Those seeders `require("pizzip")` and `require("@supabase/storage-js")`
    // when they load. Webpack cannot parse the createRequire call (it warns
    // "module.createRequire failed parsing argument"), so it never follows the
    // .cjs files' own requires: copying the scripts is not enough, their npm
    // dependencies have to be named here too or every seeder throws
    // "Cannot find module 'pizzip'" the moment a client is created in the admin
    // console — which is exactly what happened in production. Transitive deps
    // (pako, tslib, iceberg-js) are listed for the same reason.
    "/**": [
      "./templates/**",
      "./public/atk_template/**",
      "./scripts/**",
      "./node_modules/pizzip/**",
      "./node_modules/pako/**",
      "./node_modules/@supabase/storage-js/**",
      "./node_modules/iceberg-js/**",
      "./node_modules/tslib/**",
    ],
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
