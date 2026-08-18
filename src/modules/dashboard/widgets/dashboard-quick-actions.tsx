"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Palmtree, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import { type Capability } from "@/server/permissions";
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
    capability: "employees.write" as Capability,
    icon: UserPlus,
  },
  {
    href: "/dokumentet/generate?category=CONTRACT",
    label: "Gjenero kontratë",
    capability: "documents.write" as Capability,
    icon: FileText,
  },
  {
    href: "/dokumentet/templates",
    label: "Ngarko template",
    capability: "documents.write" as Capability,
    icon: FileText,
  },
  {
    // Not the "#leave-requests" anchor: that id only exists when the queue
    // happens to hold a pending request, so the menu item led nowhere on a
    // quiet day. Pushimet lists them in every state.
    href: "/pushimet?status=PENDING&month=0",
    label: "Aprovo pushime",
    capability: "leave.write" as Capability,
    icon: Palmtree,
  },
] as const;

function ActionsMenu(props: { trigger: ReactNode; align?: "start" | "end" }) {
  const held = {
    "employees.write": useCan("employees.write"),
    "documents.write": useCan("documents.write"),
    "leave.write": useCan("leave.write"),
  } as Partial<Record<Capability, boolean>>;
  const actions = DASHBOARD_ACTIONS.filter((a) => held[a.capability]);
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{props.trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={props.align ?? "end"} className="w-52">
        {actions.map(({ href, label, icon: Icon }) => (
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
            <Button className="h-10 rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white shadow-none hover:bg-[#1d4ed8]">
              Veprime të Shpejta
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          }
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e2e8f0] bg-white/95 p-3 backdrop-blur md:hidden">
        <ActionsMenu
          align="end"
          trigger={
            <Button className="h-10 w-full rounded-[10px] bg-brand-blue text-[13.5px] font-semibold text-white shadow-none hover:bg-[#1d4ed8]">
              Veprime të Shpejta
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          }
        />
      </div>
    </>
  );
}
