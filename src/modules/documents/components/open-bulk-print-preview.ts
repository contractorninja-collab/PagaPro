export type BulkPrintPreviewResult =
  | { ok: true }
  | { ok: false; error: string };

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

  try {
    const response = await fetch(
      "/api/dokumentet/contracts/bulk-pdf?inline=1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactIds }),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      previewWindow.close();
      return {
        ok: false,
        error: payload?.error ?? "Parapamja e printimit dështoi.",
      };
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    previewWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    return { ok: true };
  } catch {
    previewWindow.close();
    return { ok: false, error: "Parapamja e printimit dështoi." };
  }
}
