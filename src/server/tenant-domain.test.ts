import { afterEach, describe, expect, it } from "vitest";
import {
  adminHosts,
  isAdminHost,
  normalizeRequestHost,
  tenantSlugFromHost,
  tenantUrlForCompany,
} from "@/server/tenant-domain";

const ORIGINAL_ENV = {
  PAGAPRO_ROOT_DOMAIN: process.env.PAGAPRO_ROOT_DOMAIN,
  PAGAPRO_ROOT_DOMAINS: process.env.PAGAPRO_ROOT_DOMAINS,
  PAGAPRO_ADMIN_HOST: process.env.PAGAPRO_ADMIN_HOST,
  PAGAPRO_ADMIN_HOSTS: process.env.PAGAPRO_ADMIN_HOSTS,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("tenant-domain", () => {
  it("normalizes hosts and strips protocol, ports, and paths", () => {
    expect(normalizeRequestHost("https://Client.PagaPro.com:443/hyrje")).toBe("client.pagapro.com");
  });

  it("derives tenant slugs from configured wildcard root domains", () => {
    process.env.PAGAPRO_ROOT_DOMAIN = "pagapro.com";
    process.env.PAGAPRO_ADMIN_HOST = "";

    expect(tenantSlugFromHost("acme.pagapro.com")).toBe("acme");
    expect(tenantSlugFromHost("admin.pagapro.com")).toBeNull();
    expect(tenantSlugFromHost("app.pagapro.com")).toBeNull();
    expect(tenantSlugFromHost("pagapro.com")).toBeNull();
  });

  it("builds admin hosts and tenant URLs from env", () => {
    process.env.PAGAPRO_ROOT_DOMAIN = "pagapro.com";
    process.env.PAGAPRO_ADMIN_HOST = "console.pagapro.com";

    expect(adminHosts()).toEqual(["console.pagapro.com", "admin.pagapro.com"]);
    expect(isAdminHost("admin.pagapro.com")).toBe(true);
    expect(tenantUrlForCompany({ slug: "acme", customDomain: null })).toBe("https://acme.pagapro.com");
    expect(tenantUrlForCompany({ slug: "acme", customDomain: "hr.acme.com" })).toBe("https://hr.acme.com");
  });
});
