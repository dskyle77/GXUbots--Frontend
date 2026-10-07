import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Pulsing placeholder for loading states. */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm bg-[var(--color-hover)]",
        className,
      )}
      {...props}
    />
  );
}

/** One row matching list layouts (bots / packs / market). */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-1 py-3.5">
      <Skeleton className="size-2.5 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3 max-w-[10rem]" />
        <Skeleton className="h-3 w-1/4 max-w-[7rem]" />
      </div>
      <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
    </div>
  );
}

/** Stack of list rows for page-level loading. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <ul className="divide-y divide-border border-y border-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <SkeletonRow />
        </li>
      ))}
    </ul>
  );
}
