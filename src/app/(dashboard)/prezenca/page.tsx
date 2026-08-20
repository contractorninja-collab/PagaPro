import type { Metadata } from "next";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { isTimeClockEnabled } from "@/modules/timeclock/services/timeclock-entitlement";
import { getPresenceMonth } from "@/modules/timeclock/services/timeclock-presence-service";
import { PrezencaDashboardClient } from "@/modules/timeclock/components/prezenca-dashboard-client";
import { requireCompanyContextPage } from "@/server/company-context";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Prezenca",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function PrezencaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  // The nav hides the tab when the clock is off, but a URL is not a nav item.
  if (!(await isTimeClockEnabled(companyId))) {
    return (
      <>
        <AppSubBar
          eyebrow="Ora e punës"
          title="Prezenca"
          description="Ditët e punës të derivuara nga skanimet e kartelave."
        />
        <div className="rounded-xl border border-line bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-ink-900">
            Ora e punës nuk është e aktivizuar për këtë kompani.
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-500">
            Moduli aktivizohet nga administratori i platformës. Pas aktivizimit, skanimet nga
            kiosku në <span className="font-medium">/skano</span> shfaqen këtu si ditë pune.
          </p>
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const now = new Date();
  const yearRaw = Number(first(sp, "year"));
  const monthRaw = Number(first(sp, "month"));
  const year =
    Number.isInteger(yearRaw) && yearRaw >= 1970 && yearRaw <= 2100 ? yearRaw : now.getUTCFullYear();
  const month =
    Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getUTCMonth() + 1;

  const [presence, payroll] = await Promise.all([
    getPresenceMonth(companyId, year, month),
    prisma.payroll.findFirst({
      where: { companyId, year, month },
      select: { status: true },
    }),
  ]);

  return (
    <>
      <AppSubBar
        eyebrow="Ora e punës"
        title="Prezenca"
        description="Ditët e punës të derivuara nga skanimet — rishikoni përjashtimet dhe sinkronizoni orët në payroll."
      />
      <PrezencaDashboardClient
        presence={presence}
        payrollStatus={payroll?.status ?? null}
        todayIso={now.toISOString().slice(0, 10)}
      />
    </>
  );
}
