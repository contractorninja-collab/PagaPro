const fs = require("node:fs");
const path = require("node:path");

const LEAVE_DIR = path.join(__dirname, "..", "templates", "leave");
const MANIFEST_PATH = path.join(LEAVE_DIR, "manifest.json");

function loadLeaveManifest() {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(parsed.templates)) {
    throw new Error("templates/leave/manifest.json: expected { templates: [...] }");
  }
  return parsed.templates;
}

module.exports = { leaveDir: () => LEAVE_DIR, loadLeaveManifest };
