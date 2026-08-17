import {
  AppTopNav,
  type TopNavCompanyOption,
} from "@/components/layout/app-top-nav";
import { CapabilityProvider } from "@/components/layout/capability-provider";
import { capabilitiesOf } from "@/server/permissions";
import { MobileNav } from "@/components/layout/mobile-nav";
import { prisma } from "@/lib/prisma";
import { requireCompanyContextPage } from "@/server/company-context";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, companyId, role } = await requireCompanyContextPage();

  /**
   * Resolved once here rather than per page. Every mutating action re-checks
   * server-side regardless; this only decides which controls are worth offering,
   * so a member who cannot approve payroll stops being shown an Aprovo button
   * that was always going to refuse them.
   */
  const capabilities = capabilitiesOf({
    role,
    isPlatformAdmin: user.isPlatformAdmin,
  });

  let activeCompanyLabel: string | null = null;
  /**
   * Every company this user can reach. Customers who run several legal entities under one
   * brand hold one membership per company; for everyone else this is a single row and the
   * nav renders exactly as before.
   */
  let companies: TopNavCompanyOption[] = [];
  let timeClockEnabled = false;
  try {
    const [row, memberships] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { legalName: true, tradeName: true, timeClockEnabled: true },
      }),
      prisma.userCompanyMembership.findMany({
        where: {
          userId: user.id,
          isActive: true,
          company: { status: "ACTIVE" },
        },
        select: {
          company: { select: { id: true, legalName: true, tradeName: true } },
        },
      }),
    ]);
    if (row) {
      activeCompanyLabel = row.tradeName?.trim() || row.legalName || null;
      timeClockEnabled = row.timeClockEnabled;
    }
    companies = memberships
      .map((m) => ({
        id: m.company.id,
        label: m.company.tradeName?.trim() || m.company.legalName,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error(
      "[pagapro] DashboardLayout: company lookup failed — UI continues without tenant label.",
      err,
    );
  }

  /**
   * Only the bell's number — deliberately not the whole dashboard payload, which
   * this layout used to load on every page of the app (Punonjësit, Pagat,
   * Dokumentet…) to read one integer off it.
   */
  let alertCount = 0;
  try {
    const { countOperationalAlerts } =
      await import("@/modules/dashboard/services/dashboard-alert-count-service");
    alertCount = await countOperationalAlerts(companyId);
  } catch {
    alertCount = 0;
  }

  return (
    <CapabilityProvider capabilities={capabilities}>
      <div className="flex min-h-screen flex-col bg-brand-canvas">
        <AppTopNav
          activeCompanyLabel={activeCompanyLabel}
          activeCompanyId={companyId}
          companies={companies}
          userLabel={user.displayName}
          userEmail={user.email}
          alertCount={alertCount}
          timeClockEnabled={timeClockEnabled}
        />
        <main className="flex-1 bg-brand-canvas px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-10 md:pt-6 md:pb-9">
          {children}
        </main>
        <MobileNav timeClockEnabled={timeClockEnabled} />
      </div>
    </CapabilityProvider>
  );
}
