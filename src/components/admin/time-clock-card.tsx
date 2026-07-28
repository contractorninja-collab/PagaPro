"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, RefreshCw, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTimeClockDeviceAction,
  regenerateTimeClockPairingCodeAction,
  setCompanyTimeClockEnabledAction,
  setTimeClockDeviceActiveAction,
} from "@/modules/admin/actions/admin-actions";
import type { TimeClockDeviceRow } from "@/modules/timeclock/services/timeclock-device-service";

/**
 * Per-client entitlement for the badge time clock, plus the door devices it
 * needs. Enabling is admin-only; the pairing code is revealed once, the same way
 * temp passwords are, because it is the credential that enrols a tablet.
 */
export function TimeClockCard({
  companyId,
  enabled,
  devices,
  appOrigin,
}: {
  companyId: string;
  enabled: boolean;
  devices: TimeClockDeviceRow[];
  appOrigin: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");

  const [revealed, setRevealed] = useState<{ code: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleEnabled() {
    startTransition(async () => {
      const res = await setCompanyTimeClockEnabledAction({ companyId, enabled: !enabled });
      if (res.ok) {
        toast.success(enabled ? "Ora e punës u çaktivizua." : "Ora e punës u aktivizua.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function addDevice() {
    startTransition(async () => {
      const res = await createTimeClockDeviceAction({ companyId, label, location });
      if (res.ok && res.data) {
        setRevealed({ code: res.data.pairingCode, label });
        setAddOpen(false);
        setLabel("");
        setLocation("");
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function regenerate(deviceId: string, deviceLabel: string) {
    startTransition(async () => {
      const res = await regenerateTimeClockPairingCodeAction({ companyId, deviceId });
      if (res.ok && res.data) {
        setRevealed({ code: res.data.pairingCode, label: deviceLabel });
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function toggleDevice(deviceId: string, isActive: boolean) {
    startTransition(async () => {
      const res = await setTimeClockDeviceActiveAction({ companyId, deviceId, isActive });
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  async function copyLink() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(`${appOrigin}/skano/lidh?kod=${revealed.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopjimi dështoi — kopjojeni manualisht.");
    }
  }

  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" aria-hidden />
              Ora e punës (skanim kartelash)
            </CardTitle>
            <CardDescription>
              Punonjësit skanojnë kartelat në hyrje dhe dalje; orët kalojnë në profil dhe në pagë.
              Aktivizohet vetëm për klientët që e kërkojnë.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={enabled ? "destructive" : "default"}
            onClick={toggleEnabled}
            disabled={pending}
          >
            {enabled ? "Çaktivizo" : "Aktivizo"}
          </Button>
        </CardHeader>

        {enabled ? (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pajisjet e lidhura hapin ekranin te{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{appOrigin}/skano</code>
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Shto pajisje
              </Button>
            </div>

            {devices.length === 0 ? (
              <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Ende asnjë pajisje. Shtoni një dhe merrni kodin e lidhjes.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {devices.map((device) => (
                  <li key={device.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{device.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {device.location ?? "—"}
                        {device.lastSeenAt
                          ? ` · aktive ${new Date(device.lastSeenAt).toLocaleString("sq-AL")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!device.isActive ? (
                        <Badge variant="secondary">Çaktivizuar</Badge>
                      ) : device.pairedAt ? (
                        <Badge variant="success">E lidhur</Badge>
                      ) : device.pairingCodeExpired ? (
                        <Badge variant="warning">Kodi skadoi</Badge>
                      ) : (
                        <Badge variant="warning">Pret lidhjen</Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => regenerate(device.id, device.label)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        Kod i ri
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => toggleDevice(device.id, !device.isActive)}
                      >
                        {device.isActive ? "Çaktivizo" : "Aktivizo"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        ) : null}
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shto pajisje skanimi</DialogTitle>
            <DialogDescription>
              Emërtojeni sipas vendit ku qëndron — kodi i lidhjes shfaqet vetëm një herë.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tc-label">Emri i pajisjes</Label>
              <Input
                id="tc-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Tablet — hyrja kryesore"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-location">Vendndodhja (opsionale)</Label>
              <Input
                id="tc-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Recepsion"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Anulo
            </Button>
            <Button type="button" onClick={addDevice} disabled={pending || !label.trim()}>
              Krijo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revealed !== null} onOpenChange={(open) => !open && setRevealed(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kodi i lidhjes</DialogTitle>
            <DialogDescription>
              Hapni linkun në tabletin e{" "}
              <span className="font-medium text-foreground">{revealed?.label}</span> ose futeni kodin
              manualisht te <code className="text-xs">/skano/lidh</code>. Vlen 24 orë dhe përdoret
              vetëm një herë.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <code className="block select-all rounded-md border border-border bg-muted px-3 py-3 text-center font-mono text-2xl tracking-[0.2em]">
              {revealed?.code}
            </code>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
                {appOrigin}/skano/lidh?kod={revealed?.code}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={copyLink}
                aria-label="Kopjo linkun"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setRevealed(null)}>
              E ruajta — mbyll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
