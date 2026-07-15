import { AppTopNav } from "@/components/layout/app-top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { prisma } from "@/lib/prisma";
import { requireCompanyContextPage } from "@/server/company-context";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, companyId } = await requireCompanyContextPage();

  let activeCompanyLabel: string | null = null;
  try {
    const row = await prisma.company.findUnique({
      where: { id: companyId },
      select: { legalName: true, tradeName: true },
    });
    if (row) {
      activeCompanyLabel = row.tradeName?.trim() || row.legalName || null;
    }
  } catch (err) {
    console.error("[pagapro] DashboardLayout: company lookup failed — UI continues without tenant label.", err);
  }

  let alertCount = 0;
  try {
    const { loadDashboardOperationalData } = await import(
      "@/modules/dashboard/services/dashboard-data-service"
    );
    const { parseDashboardFilters } = await import(
      "@/modules/dashboard/helpers/dashboard-time"
    );
    const dashData = await loadDashboardOperationalData(companyId, parseDashboardFilters({}));
    alertCount = dashData.alerts?.length ?? 0;
  } catch {
    alertCount = 0;
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-canvas">
      <AppTopNav
        activeCompanyLabel={activeCompanyLabel}
        userLabel={user.displayName}
        userEmail={user.email}
        alertCount={alertCount}
      />
      <main className="flex-1 bg-brand-canvas px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-10 md:pt-6 md:pb-9">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
