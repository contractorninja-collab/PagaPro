import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormStackProps {
  children: ReactNode;
  className?: string;
}

/** Vertical rhythm for form-heavy screens — single column, consistent gaps */
export function FormStack({ children, className }: FormStackProps) {
  return <div className={cn("flex max-w-xl flex-col gap-6", className)}>{children}</div>;
}

export interface FormFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, hint, error, required, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {required ? (
          <span className="text-xs font-normal text-muted-foreground" aria-hidden>
            *
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
