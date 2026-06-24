/**
 * Shared contract template manifest — keep in sync with templates/contracts/manifest.json
 */
const path = require("node:path");
const fs = require("node:fs");

const MANIFEST_PATH = path.join(__dirname, "..", "templates", "contracts", "manifest.json");

function loadContractManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.templates)) {
    throw new Error("manifest.json: expected { templates: [...] }");
  }
  return parsed.templates;
}

function contractsDir() {
  return path.join(__dirname, "..", "templates", "contracts");
}

module.exports = { loadContractManifest, contractsDir, MANIFEST_PATH };
