"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DashboardAlertsPanel } from "@/modules/dashboard/widgets/dashboard-alerts-panel";
import { fetchAlertsAction } from "@/modules/dashboard/actions/alerts-action";
import type { OperationalAlert } from "@/modules/dashboard/types/dashboard-types";

export function AlertsSheet({
  initialCount,
  variant = "default",
}: {
  initialCount: number;
  /** "topnav" renders the dark 36px square trigger with a numeric count badge (1b shell). */
  variant?: "default" | "topnav";
}) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    startTransition(async () => {
      const data = await fetchAlertsAction();
      setAlerts(data);
      setCount(data.length);
    });
  }

  function markAllAsRead() {
    setAlerts([]);
    setCount(0);
  }

  return (
    <>
      {variant === "topnav" ? (
        <button
          type="button"
          aria-label={`Njoftime${count > 0 ? ` — ${count} aktive` : ""}`}
          onClick={handleOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/[0.07] text-slate-300 transition-colors hover:bg-white/[0.12] hover:text-white"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-lg border-2 border-brand-navy bg-destructive px-1 text-[9.5px] font-bold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`Njoftime${count > 0 ? ` — ${count} aktive` : ""}`}
          onClick={handleOpen}
          className="relative"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-destructive" aria-hidden />
          )}
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-sm font-semibold">Sinjalizime operative</SheetTitle>
              {!isPending && alerts.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={markAllAsRead}
                >
                  Marko si të lexuara
                </Button>
              ) : null}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {isPending ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Duke ngarkuar…
              </p>
            ) : (
              <DashboardAlertsPanel alerts={alerts} showHeader={false} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
