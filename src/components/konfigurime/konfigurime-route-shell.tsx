"use client";

import { useEffect, useState, type ComponentType } from "react";
import { KonfigurimePageSkeleton } from "@/components/konfigurime/konfigurime-skeleton";
import type { KonfigurimePageDto } from "@/modules/konfigurime/services/konfigurime-service";

/**
 * Keeps Radix / Sonner / heavy client modules out of the server `page.js` chunk graph.
 * Avoids intermittent Windows dev builds failing with missing `./611.js` chunks.
 */
export function KonfigurimeRouteShell({ initial }: { initial: KonfigurimePageDto }) {
  const [Inner, setInner] = useState<ComponentType<{ initial: KonfigurimePageDto }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/konfigurime/konfigurime-configurator").then((m) => {
      if (!cancelled) setInner(() => m.KonfigurimeConfigurator);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Inner) {
    return <KonfigurimePageSkeleton />;
  }

  return <Inner initial={initial} />;
}
