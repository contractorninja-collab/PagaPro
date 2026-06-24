import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export function AppShell({
  children,
  activeCompanyLabel,
  userLabel,
  userEmail,
}: {
  children: ReactNode;
  activeCompanyLabel: string | null;
  userLabel?: string | null;
  userEmail?: string | null;
}) {
  return (
    <div className="min-h-screen bg-brand-canvas">
      <AppSidebar />
      <div className="flex min-h-screen flex-col md:pl-60">
        <AppHeader activeCompanyLabel={activeCompanyLabel} userLabel={userLabel} userEmail={userEmail} />
        <main className="flex-1 bg-brand-canvas px-4 py-6 md:px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 border-l border-border max-md:border-l-0">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
