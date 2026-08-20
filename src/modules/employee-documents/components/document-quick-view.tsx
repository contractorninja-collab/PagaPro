"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface QuickViewTarget {
  /** Must serve the file inline (route with ?inline=1). */
  url: string;
  title: string;
  kind: "image" | "pdf";
  /** Plain (attachment) URL for the download link; defaults to `url`. */
  downloadUrl?: string;
}

/**
 * The quick-view pane: one dialog per page, fed a target by whichever row was
 * clicked. Images render directly; PDFs go through an iframe against the same
 * inline-serving route the browser tab would use — no extra endpoint, so the
 * download audit fires for previews exactly as for downloads.
 */
export function DocumentQuickView({
  target,
  onClose,
}: {
  target: QuickViewTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="flex h-[88vh] max-w-4xl flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex flex-wrap items-baseline gap-x-4 pr-6 text-[15px]">
            <span className="min-w-0 truncate">{target?.title}</span>
            {target ? (
              <span className="flex gap-3 text-[12.5px] font-medium">
                <a className="text-brand-blue hover:underline" href={target.url} target="_blank" rel="noreferrer">
                  Hape në tab
                </a>
                <a className="text-brand-blue hover:underline" href={target.downloadUrl ?? target.url.replace(/\?inline=1$/, "")}>
                  Shkarko
                </a>
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
          {target?.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob served by our own authed route; next/image cannot optimize it
            <img src={target.url} alt={target.title} className="mx-auto max-h-full max-w-full object-contain p-2" />
          ) : target ? (
            <iframe src={target.url} title={target.title} className="h-full w-full" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
