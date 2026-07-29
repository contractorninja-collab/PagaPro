/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const ANNEX_DIR = path.join(__dirname, "..", "templates", "annex");
const MANIFEST_PATH = path.join(ANNEX_DIR, "manifest.json");

function loadAnnexManifest() {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(parsed.templates)) {
    throw new Error("templates/annex/manifest.json: expected { templates: [...] }");
  }
  return parsed.templates;
}

module.exports = { annexDir: () => ANNEX_DIR, loadAnnexManifest };
