const fs = require("node:fs");
const path = require("node:path");

const TERMINATION_DIR = path.join(__dirname, "..", "templates", "termination");
const MANIFEST_PATH = path.join(TERMINATION_DIR, "manifest.json");
const WORKFLOW_KEYS = new Set([
  "LARGIM_VULLNETAR",
  "PA_PARALAJMERIM",
  "MARREVESHJE_E_DYANSHME",
  "NGA_PUNEDHENESI",
  "MANUAL",
]);

function loadTerminationManifest() {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(parsed.templates)) {
    throw new Error("templates/termination/manifest.json: expected { templates: [...] }");
  }
  for (const entry of parsed.templates) {
    if (!WORKFLOW_KEYS.has(entry.terminationWorkflowKey)) {
      throw new Error(`Invalid terminationWorkflowKey: ${entry.terminationWorkflowKey}`);
    }
  }
  return parsed.templates;
}

module.exports = {
  loadTerminationManifest,
  terminationDir: () => TERMINATION_DIR,
};
