import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/modules/auth/services/session";
import { resolveActiveCompanyId } from "@/server/company-scope";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/hyrje");
  if (user.mustChangePassword) redirect("/ndrysho-fjalekalimin");

  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    redirect(user.isPlatformAdmin ? "/admin" : "/auth/kompani");
  }

  if (!user.isPlatformAdmin) {
    const membership = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
      select: { isActive: true },
    });
    if (!membership?.isActive) {
      // Cookie points to a company this user can't access — re-resolve via route handler.
      redirect("/auth/kompani");
    }
  }

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
    <AppShell
      activeCompanyLabel={activeCompanyLabel}
      userLabel={user.displayName}
      userEmail={user.email}
      alertCount={alertCount}
    >
      {children}
    </AppShell>
  );
}
