import { describe, expect, it } from "vitest";
import { adminPath, normalizeAdminBasePath } from "./admin-path";

describe("admin path", () => {
  it("normalizes a configured opaque path", () => {
    expect(normalizeAdminBasePath(" /Qendra-Ops-7K3M9X2Q/ ")).toBe(
      "/qendra-ops-7k3m9x2q",
    );
  });

  it("rejects the public admin route and malformed paths", () => {
    expect(normalizeAdminBasePath("/admin")).toBe("/admin-console");
    expect(normalizeAdminBasePath("/admin/extra")).toBe("/admin-console");
  });

  it("joins child routes onto the configured base", () => {
    expect(adminPath("/bizneset")).toMatch(/\/bizneset$/);
  });
});
