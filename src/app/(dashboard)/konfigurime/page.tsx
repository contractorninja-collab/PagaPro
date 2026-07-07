import type { Metadata } from "next";
import { KonfigurimeRouteShell } from "@/components/konfigurime/konfigurime-route-shell";
import { parseKonfigurimeTabId } from "@/components/konfigurime/konfigurime-tabs";
import { loadKonfigurimePageDto } from "@/modules/konfigurime/services/konfigurime-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

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
  const companyId = await resolveActiveCompanyId();
  const sp = await searchParams;
  const initialTab = parseKonfigurimeTabId(first(sp.tab));

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Konfigurimet</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code>, variablën e mjedisit{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>, ose në development
          përdorni <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/dev/active-company</code> me{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{"companyId":"..."}`}</code>.
        </p>
      </div>
    );
  }

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
