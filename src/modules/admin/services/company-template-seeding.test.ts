import { describe, expect, it } from "vitest";
import { FAMILIES, requireFromScriptsDir } from "./company-template-seeding";

/**
 * These tests run the REAL loading mechanism — the same
 * process.getBuiltinModule require that production provisioning uses — not a
 * mock of it. Under Next 15.5, webpack silently compiled the old
 * `import { createRequire } from "node:module"` down to `let c = void 0`,
 * and every company created between deploys got zero document templates.
 * Nothing failed at build time; only a runtime probe like this catches it.
 * (Vitest does not bundle like webpack, so this cannot catch a future
 * BUNDLER regression — that is what the post-build chunk check in the deploy
 * notes is for — but it pins the runtime contract: the API exists on this
 * Node, the scripts resolve, and every family exports what it claims.)
 */
describe("company template seeding loader", () => {
  it("acquires a working require via process.getBuiltinModule", () => {
    const req = requireFromScriptsDir();
    expect(typeof req).toBe("function");
  });

  it("every declared family module exists and exports its seeder function", () => {
    const req = requireFromScriptsDir();
    for (const family of FAMILIES) {
      const mod = req(family.module) as Record<string, unknown>;
      expect(typeof mod[family.export], `${family.module} → ${family.export}`).toBe("function");
    }
  });

  it("covers all five template families", () => {
    expect(FAMILIES.map((f) => f.label).sort()).toEqual(
      ["anekset", "kontratat", "largimet", "pushimet", "vërejtjet"].sort(),
    );
  });
});
