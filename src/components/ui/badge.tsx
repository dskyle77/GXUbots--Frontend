"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "bg-secondary text-muted-foreground",
        primary: "bg-primary/15 text-primary",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusDot({
  status,
  className,
}: {
  status: "ok" | "warn" | "error" | "muted";
  className?: string;
}) {
  const color =
    status === "ok"
      ? "bg-success"
      : status === "warn"
        ? "bg-warning"
        : status === "error"
          ? "bg-destructive"
          : "bg-muted-foreground";
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", color, className)}
      aria-hidden
    />
  );
}
