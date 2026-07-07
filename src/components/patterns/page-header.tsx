import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Standard workspace page title row — use under app header on every screen */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "page-header flex flex-col gap-4 border-b border-border md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader(props: { id?: string; title: string; description?: string; className?: string }) {
  return (
    <div className={cn("space-y-1", props.className)}>
      <h2 id={props.id} className="section-title">
        {props.title}
      </h2>
      {props.description ? <p className="section-description">{props.description}</p> : null}
    </div>
  );
}

export function PanelHeader(props: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("card-header px-5 pt-5", props.className)}>
      <h2 className="section-title">{props.title}</h2>
      {props.description ? <p className="section-description mt-1">{props.description}</p> : null}
    </div>
  );
}
