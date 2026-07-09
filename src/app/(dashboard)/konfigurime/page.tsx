import type { Metadata } from "next";
import { KonfigurimeRouteShell } from "@/components/konfigurime/konfigurime-route-shell";
import { parseKonfigurimeTabId } from "@/components/konfigurime/konfigurime-tabs";
import { loadKonfigurimePageDto } from "@/modules/konfigurime/services/konfigurime-service";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Konfigurimet",
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function KonfigurimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();
  const sp = await searchParams;
  const initialTab = parseKonfigurimeTabId(first(sp.tab));

  let initial;
  try {
    initial = await loadKonfigurimePageDto(companyId);
  } catch (err) {
    console.error("[pagapro] KonfigurimePage: loadKonfigurimePageDto failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të ngarkohen konfigurimet. Sigurohuni që databaza është në punë dhe ekzekutoni{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>, pastaj rifreskoni.
        </p>
      </div>
    );
  }

  if (!initial) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">Kompania nuk u gjet në databazë.</p>
      </div>
    );
  }

  return <KonfigurimeRouteShell initial={initial} initialTab={initialTab} />;
}
