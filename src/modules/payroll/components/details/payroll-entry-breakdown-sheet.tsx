"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PayrollEntryBreakdownSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  breakdown: unknown;
}) {
  const json =
    props.breakdown === null || props.breakdown === undefined
      ? "{}"
      : JSON.stringify(props.breakdown, null, 2);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg md:max-w-xl">
        <SheetHeader className="shrink-0 pr-8">
          <SheetTitle>{props.title}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Pamje nga <code className="rounded bg-muted px-1">calculationBreakdown</code> (readonly).
          </p>
        </SheetHeader>
        <pre className="mt-4 max-h-[calc(100vh-8rem)] flex-1 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground">
          {json}
        </pre>
      </SheetContent>
    </Sheet>
  );
}
