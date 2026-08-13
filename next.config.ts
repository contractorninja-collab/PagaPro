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
   * Baseline security headers on every response. A payroll app has no business
   * being framed, sniffed, or leaking referrers. No CSP yet — Next's inline
   * runtime needs nonces and a broken CSP fails silently in the worst way;
   * that lands as its own change with real testing.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Two years, subdomains included — browsers refuse plain HTTP after the first visit.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
