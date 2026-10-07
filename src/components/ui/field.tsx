"use client";

import * as React from "react";
import { cn } from "../../lib/cn";

export function Field({
  label,
  children,
  hint,
  error,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-xs font-medium text-foreground/80">{label}</span>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-xs text-warning">{error}</p> : null}
      {!error && hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}
