"use client";

import Link from "next/link";
import { FileText, Landmark, Palmtree, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardQuickActions() {
  return (
    <>
      <div className="hidden flex-wrap gap-2 md:flex">
        <Button size="sm" variant="secondary" asChild>
          <Link href="/punonjesit">
            <UserPlus className="mr-1 h-4 w-4" aria-hidden />
            Shto punonjës
          </Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link href="/dokumentet/generate?category=CONTRACT">Gjenero kontratë</Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link href="/pagat">
            <Landmark className="mr-1 h-4 w-4" aria-hidden />
            Krijo payroll
          </Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link href="/dokumentet/templates">
            <FileText className="mr-1 h-4 w-4" aria-hidden />
            Ngarko template
          </Link>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <Link href="#leave-requests">
            <Palmtree className="mr-1 h-4 w-4" aria-hidden />
            Aprovo pushime
          </Link>
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 overflow-x-auto border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Button size="sm" variant="secondary" className="shrink-0" asChild>
          <Link href="/punonjesit">+ Punonjës</Link>
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" asChild>
          <Link href="/dokumentet/generate?category=CONTRACT">Kontratë</Link>
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" asChild>
          <Link href="/pagat">Payroll</Link>
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" asChild>
          <Link href="/dokumentet/templates">Template</Link>
        </Button>
        <Button size="sm" variant="secondary" className="shrink-0" asChild>
          <Link href="#leave-requests">Pushime</Link>
        </Button>
      </div>
    </>
  );
}
