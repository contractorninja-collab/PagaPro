import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SIDEBAR_SHELL_OFFSET } from "@/components/layout/sidebar-styles";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  activeCompanyLabel,
  userLabel,
  userEmail,
  alertCount = 0,
}: {
  children: ReactNode;
  activeCompanyLabel: string | null;
  userLabel?: string | null;
  userEmail?: string | null;
  alertCount?: number;
}) {
  return (
    <div className="min-h-screen bg-brand-canvas">
      <AppSidebar />
      <div className={cn("flex min-h-screen flex-col", SIDEBAR_SHELL_OFFSET)}>
        <AppHeader
          activeCompanyLabel={activeCompanyLabel}
          userLabel={userLabel}
          userEmail={userEmail}
          alertCount={alertCount}
        />
        <main className="flex-1 border-l border-border bg-brand-canvas px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] max-md:border-l-0 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
