"use client";

import { useState, type ReactNode } from "react";
import { useCan } from "@/components/layout/capability-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Lësho vërejtje" lives in the sub-bar next to the other register actions.
 *
 * It used to be one of the quick-start tiles, but those are now filters (click
 * a category, see that category) — an action that opens a dialog doesn't
 * belong mixed into a row of things that filter. Self-contained so it can sit
 * in the server-rendered sub-bar without threading dialog state through the
 * register's client component.
 */
export function WarningIssueTrigger({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  /**
   * Issuing a vërejtje is a disciplinary act against an employee record, so it
   * is employees.write rather than documents.write — the document is a
   * by-product. Gated here rather than at the mount so it holds wherever the
   * trigger is placed.
   */
  const canIssueWarnings = useCan("employees.write");
  if (!canIssueWarnings) return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Lësho vërejtje
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lësho vërejtje</DialogTitle>
            <DialogDescription>
              Zgjidhni punonjësit, masën sipas nenit 85 dhe përshkrimin e shkeljes.
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}
