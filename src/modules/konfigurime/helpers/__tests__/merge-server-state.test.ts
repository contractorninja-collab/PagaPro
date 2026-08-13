import { describe, expect, it } from "vitest";
import {
  applyServerChanges,
  mergeEmployeeOptions,
  representativesMatch,
} from "@/modules/konfigurime/helpers/merge-server-state";

interface CompanyFields {
  legalName: string;
  fiscalNumber: string | null;
  addressLine: string | null;
  email: string | null;
}

describe("applyServerChanges", () => {
  const server: CompanyFields = {
    legalName: "ACME",
    fiscalNumber: null,
    addressLine: null,
    email: null,
  };

  it("keeps what the client typed when the server sends the same data again", () => {
    // Adding a job title revalidates /konfigurime; the DTO comes back identical.
    const typed = { ...server, fiscalNumber: "811555444", addressLine: "Rr. B 8" };
    expect(applyServerChanges(typed, server, server)).toEqual(typed);
  });

  it("returns the same object when nothing moves, so React can skip a render", () => {
    const typed = { ...server, fiscalNumber: "811555444" };
    expect(applyServerChanges(typed, server, server)).toBe(typed);
  });

  it("keeps a field the client cleared while the server repeats the old value", () => {
    const withValue = { ...server, email: "old@acme.example" };
    const cleared = { ...withValue, email: "" };
    expect(applyServerChanges(cleared, withValue, withValue).email).toBe("");
  });

  it("adopts server changes for fields the client has not touched", () => {
    const typed = { ...server, fiscalNumber: "811555444" };
    const next = { ...server, email: "zyra@acme.example" };
    const out = applyServerChanges(typed, server, next);
    expect(out.email).toBe("zyra@acme.example");
    expect(out.fiscalNumber).toBe("811555444");
  });

  it("shows the normalised value the save actually stored, not the raw typing", () => {
    // The service prepends https:// — the form must not keep claiming otherwise,
    // or it re-sends the stale text over anyone else's later correction.
    const typed = { ...server, website: "kompania.com" } as CompanyFields & { website: string };
    const before = { ...server, website: null } as CompanyFields & { website: string | null };
    const afterSave = { ...server, website: "https://kompania.com" } as typeof before;
    expect(applyServerChanges(typed, before, afterSave).website).toBe("https://kompania.com");
  });

  it("shows a decimal back at column scale rather than latching the typed text", () => {
    const typed = { ...server, minimum: "500" } as CompanyFields & { minimum: string };
    const before = { ...server, minimum: "425.00" } as typeof typed;
    const afterSave = { ...server, minimum: "500.00" } as typeof typed;
    expect(applyServerChanges(typed, before, afterSave).minimum).toBe("500.00");
  });

  it("lets a colleague's edit through instead of pinning a stale value", () => {
    const typed = { ...server, legalName: "ACME sh.p.k." };
    const renamedElsewhere = { ...server, legalName: "ACME Group sh.p.k." };
    expect(applyServerChanges(typed, server, renamedElsewhere).legalName).toBe(
      "ACME Group sh.p.k.",
    );
  });
});

describe("representativesMatch", () => {
  it("matches the same people in the same order", () => {
    expect(representativesMatch([{ employeeId: "a" }], [{ employeeId: "a" }])).toBe(true);
  });

  it("does not match once the client picks someone else", () => {
    expect(representativesMatch([{ employeeId: "b" }], [{ employeeId: "a" }])).toBe(false);
  });

  it("does not match when the client added or removed a row", () => {
    expect(
      representativesMatch([{ employeeId: "a" }, { employeeId: "b" }], [{ employeeId: "a" }]),
    ).toBe(false);
  });

  it("matches the synthesised blank row a company with no signer gets", () => {
    expect(representativesMatch([{ employeeId: null }], [{ employeeId: null }])).toBe(true);
  });
});

describe("mergeEmployeeOptions", () => {
  it("keeps people the wizard created that the server has not returned yet", () => {
    const local = [{ id: "srv-1" }, { id: "wiz-1" }];
    const fromServer = [{ id: "srv-1" }];
    expect(mergeEmployeeOptions(local, fromServer).map((e) => e.id)).toEqual(["srv-1", "wiz-1"]);
  });

  it("does not duplicate a person once the server catches up", () => {
    const local = [{ id: "srv-1" }, { id: "wiz-1" }];
    const fromServer = [{ id: "srv-1" }, { id: "wiz-1" }];
    expect(mergeEmployeeOptions(local, fromServer).map((e) => e.id)).toEqual(["srv-1", "wiz-1"]);
  });

  it("takes the server list when it is the only source", () => {
    expect(mergeEmployeeOptions([], [{ id: "srv-1" }]).map((e) => e.id)).toEqual(["srv-1"]);
  });
});
