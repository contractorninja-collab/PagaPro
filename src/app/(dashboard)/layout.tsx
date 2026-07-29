import { AppTopNav, type TopNavCompanyOption } from "@/components/layout/app-top-nav";
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
  /**
   * Every company this user can reach. Customers who run several legal entities under one
   * brand hold one membership per company; for everyone else this is a single row and the
   * nav renders exactly as before.
   */
  let companies: TopNavCompanyOption[] = [];
  try {
    const [row, memberships] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { legalName: true, tradeName: true },
      }),
      prisma.userCompanyMembership.findMany({
        where: { userId: user.id, isActive: true, company: { status: "ACTIVE" } },
        select: { company: { select: { id: true, legalName: true, tradeName: true } } },
      }),
    ]);
    if (row) {
      activeCompanyLabel = row.tradeName?.trim() || row.legalName || null;
    }
    companies = memberships
      .map((m) => ({
        id: m.company.id,
        label: m.company.tradeName?.trim() || m.company.legalName,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
        activeCompanyId={companyId}
        companies={companies}
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
