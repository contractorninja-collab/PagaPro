"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setCompanyContractorPayrollEnabledAction } from "@/modules/admin/actions/admin-actions";

export function ContractorPayrollCard(props: { companyId: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleEnabled() {
    startTransition(async () => {
      const res = await setCompanyContractorPayrollEnabledAction({
        companyId: props.companyId,
        enabled: !props.enabled,
      });
      if (res.ok) {
        toast.success(
          props.enabled ? "Kontraktor Payroll u çaktivizua." : "Kontraktor Payroll u aktivizua.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" aria-hidden />
            Kontraktor Payroll (orë × tarifë)
          </CardTitle>
          <CardDescription>
            Payroll i dytë, i veçantë, vetëm për kontraktorë — pagesa orë × tarifë orare, pa tatim
            e pa Trust. Klienti sheh çelësin Rregullt / Kontraktor te Pagat vetëm kur ky opsion
            është aktiv.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant={props.enabled ? "destructive" : "default"}
          onClick={toggleEnabled}
          disabled={pending}
        >
          {props.enabled ? "Çaktivizo" : "Aktivizo"}
        </Button>
      </CardHeader>
      {props.enabled ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aktiv — klienti mund të krijojë periudha kontraktorësh te <strong>Pagat → Kontraktor</strong>,
            t&apos;i plotësojë orët me dorë ose nga ora e punës, dhe të shkarkojë CSV.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
