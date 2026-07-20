/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Deployment safety guards for schema-changing operations.
 *
 * Background: Vercel Preview and Production are configured with the SAME
 * POSTGRES_* values, so a preview build's `prisma migrate deploy` runs against
 * the live production database. On 2026-07-20 that dropped a table while
 * production was still serving code that queried it.
 *
 * The invariant enforced here is deliberately NOT "preview must not migrate" —
 * it is:
 *
 *     A non-production deployment must never migrate the PRODUCTION SCHEMA.
 *
 * Keying on the target schema rather than the environment means that once
 * Preview is given its own PAGAPRO_DATABASE_SCHEMA, preview builds migrate that
 * schema normally instead of being permanently blocked.
 */

/** Mirrors the precedence in prisma.config.ts — keep the two in sync. */
function resolveConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    null
  );
}

/** Mirrors the schema resolution in prisma.config.ts — keep the two in sync. */
function resolveTargetSchema() {
  return (
    process.env.PAGAPRO_DATABASE_SCHEMA?.trim() ||
    (process.env.VERCEL ? "pagapro" : "public")
  );
}

/**
 * The schema that holds live customer data. Overridable so the guard keeps
 * working if the production schema is ever renamed.
 */
function resolveProductionSchema() {
  return process.env.PAGAPRO_PRODUCTION_SCHEMA?.trim() || "pagapro";
}

function describeDeployTarget() {
  const targetSchema = resolveTargetSchema();
  const productionSchema = resolveProductionSchema();
  const vercelEnv = process.env.VERCEL_ENV || null;

  let host = null;
  const connectionString = resolveConnectionString();
  if (connectionString) {
    try {
      host = new URL(connectionString).hostname;
    } catch {
      host = null;
    }
  }

  return {
    isVercel: Boolean(process.env.VERCEL),
    vercelEnv,
    host,
    targetSchema,
    productionSchema,
    /** Are we pointed at the schema that holds live customer data? */
    isProductionTarget: targetSchema === productionSchema,
    /** Is this the production deployment that is allowed to change it? */
    isProductionDeploy: vercelEnv === "production",
    hasConnection: Boolean(connectionString),
  };
}

function formatTarget(target) {
  const where = target.isVercel
    ? `Vercel (VERCEL_ENV=${target.vercelEnv ?? "unset"})`
    : "local";
  return `${where} -> schema "${target.targetSchema}"${target.host ? ` on ${target.host}` : ""}`;
}

function banner(lines) {
  const width = Math.max(...lines.map((l) => l.length)) + 2;
  const edge = "=".repeat(width);
  return ["", edge, ...lines.map((l) => ` ${l}`), edge, ""].join("\n");
}

/**
 * Decides whether schema-changing work may proceed.
 * Returns { allowed: true } or { allowed: false, reason, fatal }.
 *
 * fatal=false means "skip quietly and let the build continue" (the shared-DB
 * preview case — the build is still useful, it just must not touch the schema).
 * fatal=true means the caller should abort with a non-zero exit.
 */
function evaluateSchemaChange({ destructiveMigrations = [] } = {}) {
  const target = describeDeployTarget();

  // Guard A — a non-production deployment must not touch the production schema.
  if (target.isVercel && !target.isProductionDeploy && target.isProductionTarget) {
    return {
      allowed: false,
      fatal: false,
      target,
      reason: banner([
        "SKIPPING DATABASE MIGRATIONS",
        "",
        `This is a ${target.vercelEnv ?? "non-production"} deployment, but it is pointed at the`,
        `PRODUCTION schema ("${target.productionSchema}"). Migrating from here would change the`,
        "schema underneath the live production deployment — which is exactly what",
        "caused the 2026-07-20 Largimet outage.",
        "",
        "The build will continue WITHOUT applying migrations.",
        "",
        "This deployment is also reading and writing LIVE PRODUCTION DATA.",
        "To fix properly, give Preview its own schema in the Vercel dashboard:",
        "  Settings > Environment Variables > add for Preview only:",
        "    PAGAPRO_DATABASE_SCHEMA = pagapro_preview",
        "Preview will then bootstrap and migrate its own schema automatically.",
      ]),
    };
  }

  // Guard B (defence in depth) — destructive changes to the production schema
  // require an actual production deployment, or an explicit override.
  if (
    destructiveMigrations.length > 0 &&
    target.isProductionTarget &&
    !target.isProductionDeploy &&
    process.env.PAGAPRO_ALLOW_DESTRUCTIVE_MIGRATIONS !== "1"
  ) {
    return {
      allowed: false,
      fatal: true,
      target,
      reason: banner([
        "REFUSING DESTRUCTIVE MIGRATION",
        "",
        `Target: ${formatTarget(target)}`,
        "",
        "These pending migrations drop tables, columns or types:",
        ...destructiveMigrations.map((m) => `  - ${m.name}: ${m.statements.join(", ")}`),
        "",
        "That target holds live customer data, and this is not a production",
        "deployment. Refusing.",
        "",
        "If you really intend this, re-run with:",
        "  PAGAPRO_ALLOW_DESTRUCTIVE_MIGRATIONS=1",
      ]),
    };
  }

  return { allowed: true, target };
}

module.exports = {
  resolveConnectionString,
  resolveTargetSchema,
  resolveProductionSchema,
  describeDeployTarget,
  evaluateSchemaChange,
  formatTarget,
};
