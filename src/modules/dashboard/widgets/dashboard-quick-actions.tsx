"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Palmtree, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DASHBOARD_ACTIONS = [
  {
    href: "/punonjesit",
    label: "Shto punonjës",
    icon: UserPlus,
  },
  {
    href: "/dokumentet/generate?category=CONTRACT",
    label: "Gjenero kontratë",
    icon: FileText,
  },
  {
    href: "/dokumentet/templates",
    label: "Ngarko template",
    icon: FileText,
  },
  {
    href: "#leave-requests",
    label: "Aprovo pushime",
    icon: Palmtree,
  },
] as const;

function ActionsMenu(props: { trigger: ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{props.trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={props.align ?? "end"} className="w-52">
        {DASHBOARD_ACTIONS.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardQuickActions() {
  return (
    <>
      <div className="hidden md:block">
        <ActionsMenu
          trigger={
            <Button size="sm" variant="secondary">
              Veprime të Shpejta
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          }
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <ActionsMenu
          align="end"
          trigger={
            <Button size="sm" variant="secondary" className="w-full">
              Veprime të Shpejta
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          }
        />
      </div>
    </>
  );
}
