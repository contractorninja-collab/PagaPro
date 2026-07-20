/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Shared blob storage for the .cjs seeders and the backfill script.
 *
 * The seeders live outside the TypeScript module graph, so they cannot import
 * src/lib/company-asset-storage.ts. This mirrors it, with the same env
 * precedence, so `npm run termination:seed` writes wherever the app reads.
 *
 * The backend is resolved ONCE at module load and closed over by every helper.
 * A mixed pair — writing to the bucket while the skip-check reads local disk —
 * must be impossible by construction: that combination silently leaves the
 * bucket empty while the database claims a published version exists.
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function resolveConfig() {
  const explicit = process.env.PAGAPRO_STORAGE_DRIVER?.trim().toLowerCase();
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.PAGAPRO_STORAGE_BUCKET?.trim();
  const complete = Boolean(url && serviceRoleKey && bucket);

  const root =
    process.env.COMPANY_ASSET_STORAGE_ROOT?.trim() ||
    path.join(REPO_ROOT, ".local-storage", "company-assets");

  if (explicit === "local") return { driver: "local", root };
  if (explicit === "supabase" && !complete) {
    throw new Error(
      "PAGAPRO_STORAGE_DRIVER=supabase requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PAGAPRO_STORAGE_BUCKET.",
    );
  }
  if (complete) return { driver: "supabase", url, serviceRoleKey, bucket };
  return { driver: "local", root };
}

const cfg = resolveConfig();

let bucketApi = null;
function getBucketApi() {
  if (!bucketApi) {
    const { StorageClient } = require("@supabase/storage-js");
    const base = cfg.url.replace(/\/$/, "");
    bucketApi = new StorageClient(`${base}/storage/v1`, {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
    }).from(cfg.bucket);
  }
  return bucketApi;
}

function describeStorage() {
  if (cfg.driver === "supabase") {
    let host = "?";
    try {
      host = new URL(cfg.url).hostname;
    } catch {
      /* placeholder */
    }
    return `supabase (bucket=${cfg.bucket}, host=${host})`;
  }
  return `local (${cfg.root})`;
}

function isNotFound(error) {
  if (!error) return false;
  const status = String(error.statusCode ?? "");
  return status === "404" || /not.?found|does not exist/i.test(error.message ?? "");
}

function contentTypeForExtension(key) {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  const map = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
    csv: "text/csv; charset=utf-8",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

async function putStorage(key, buffer, contentType) {
  if (cfg.driver === "local") {
    const target = path.join(cfg.root, key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, buffer);
    return;
  }
  const { error } = await getBucketApi().upload(key, buffer, {
    contentType: contentType || contentTypeForExtension(key),
    upsert: true,
  });
  if (error) throw new Error(`storage put failed for ${key}: ${error.message}`);
}

/**
 * Returns the blob, or null when it is genuinely ABSENT. Throws on any real
 * failure. That asymmetry is the whole point: the seeders treat a read failure
 * as "template changed" and republish, so a transient error must abort loudly
 * rather than silently minting v(n+1).
 */
async function getStorage(key) {
  if (cfg.driver === "local") {
    try {
      return await fsp.readFile(path.join(cfg.root, key));
    } catch (err) {
      if (err && err.code === "ENOENT") return null;
      throw err;
    }
  }
  const { data, error } = await getBucketApi().download(key);
  if (error) {
    if (isNotFound(error)) return null;
    throw new Error(`storage get failed for ${key}: ${error.message}`);
  }
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function headStorage(key) {
  if (cfg.driver === "local") {
    return fs.existsSync(path.join(cfg.root, key));
  }
  const slash = key.lastIndexOf("/");
  const prefix = slash === -1 ? "" : key.slice(0, slash);
  const name = slash === -1 ? key : key.slice(slash + 1);
  const { data, error } = await getBucketApi().list(prefix, { search: name, limit: 100 });
  if (error) throw new Error(`storage head failed for ${key}: ${error.message}`);
  return (data || []).some((entry) => entry.name === name);
}

module.exports = {
  resolveConfig,
  describeStorage,
  putStorage,
  getStorage,
  headStorage,
  contentTypeForExtension,
  storageDriver: cfg.driver,
};
