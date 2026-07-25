import { afterEach, describe, expect, it, vi } from "vitest";
import { openBulkPrintPreview } from "./open-bulk-print-preview";

interface StubWindow {
  location: { replace: ReturnType<typeof vi.fn> };
  opener: unknown;
  document: { title: string; body: { textContent: string } };
}

function stubBrowser(opened: StubWindow | null) {
  const openedWindow = opened;
  vi.stubGlobal("window", {
    open: vi.fn(() => openedWindow),
    setTimeout: vi.fn(),
  });
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:merged-pdf"), revokeObjectURL: vi.fn() });
  return openedWindow;
}

function newWindow(): StubWindow {
  return {
    location: { replace: vi.fn() },
    opener: {},
    document: { title: "", body: { textContent: "" } },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openBulkPrintPreview", () => {
  it("shows the merged PDF when the converter produced one", async () => {
    const tab = stubBrowser(newWindow())!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(["%PDF"]) })),
    );

    const result = await openBulkPrintPreview(["a", "b"]);

    expect(result).toEqual({ ok: true });
    expect(tab.location.replace).toHaveBeenCalledWith("blob:merged-pdf");
  });

  it("falls back to the HTML print view when no PDF converter is available", async () => {
    const tab = stubBrowser(newWindow())!;
    // 409 is what the bulk-pdf route returns in DOCX-only mode (the production case).
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409 })));

    const result = await openBulkPrintPreview(["a", "b"]);

    expect(result).toEqual({ ok: true });
    expect(tab.location.replace).toHaveBeenCalledWith("/api/dokumentet/print?ids=a,b");
  });

  it("falls back to the HTML print view when the request itself fails", async () => {
    const tab = stubBrowser(newWindow())!;
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    await openBulkPrintPreview(["only-one"]);

    expect(tab.location.replace).toHaveBeenCalledWith("/api/dokumentet/print?ids=only-one");
  });

  it("reports a blocked popup instead of silently doing nothing", async () => {
    stubBrowser(null);
    const result = await openBulkPrintPreview(["a"]);
    expect(result).toEqual({ ok: false, error: "Lejoni pop-up-et për të hapur parapamjen e printimit." });
  });

  it("rejects an empty selection", async () => {
    stubBrowser(newWindow());
    const result = await openBulkPrintPreview([]);
    expect(result.ok).toBe(false);
  });
});
