/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const WARNING_DIR = path.join(__dirname, "..", "templates", "warning");
const MANIFEST_PATH = path.join(WARNING_DIR, "manifest.json");

function loadWarningManifest() {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(parsed.templates)) {
    throw new Error("templates/warning/manifest.json: expected { templates: [...] }");
  }
  return parsed.templates;
}

module.exports = { warningDir: () => WARNING_DIR, loadWarningManifest };
