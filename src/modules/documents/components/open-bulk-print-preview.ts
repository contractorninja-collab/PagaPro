export type BulkPrintPreviewResult =
  | { ok: true }
  | { ok: false; error: string };

function htmlPrintUrl(artifactIds: string[]): string {
  return `/api/dokumentet/print?ids=${artifactIds.map(encodeURIComponent).join(",")}`;
}

/**
 * Opens a print preview holding every generated document.
 *
 * A merged PDF is preferred — it is exactly what Word would print. That needs a
 * DOCX→PDF converter, which a serverless deployment does not have, so when the
 * merge is unavailable the same tab is pointed at the HTML print view instead of
 * being closed with an error. The tab is opened synchronously, inside the click,
 * so the popup blocker allows it.
 */
export async function openBulkPrintPreview(
  artifactIds: string[],
): Promise<BulkPrintPreviewResult> {
  if (artifactIds.length === 0) {
    return { ok: false, error: "Nuk ka dokumente për parapamje." };
  }

  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) {
    return {
      ok: false,
      error: "Lejoni pop-up-et për të hapur parapamjen e printimit.",
    };
  }

  previewWindow.opener = null;
  previewWindow.document.title = "Duke përgatitur parapamjen…";
  previewWindow.document.body.textContent =
    "Duke përgatitur dokumentet për printim…";

  const fallbackToHtmlView = (): BulkPrintPreviewResult => {
    previewWindow.location.replace(htmlPrintUrl(artifactIds));
    return { ok: true };
  };

  try {
    const response = await fetch(
      "/api/dokumentet/contracts/bulk-pdf?inline=1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactIds }),
      },
    );
    if (!response.ok) return fallbackToHtmlView();

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    previewWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    return { ok: true };
  } catch {
    return fallbackToHtmlView();
  }
}
