"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { listMarketPacks } from "../../../lib/market";
import type { PackSummary } from "../../../lib/packs";
import { useAuth } from "../../../components/AuthProvider";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { SkeletonList } from "../../../components/ui/skeleton";

export default function MarketPage() {
  const { owner } = useAuth();
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMarketPacks()
      .then(setPacks)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load the market"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell
      title="Market"
      description="Published packs. Install one on a bot you already have."
    >
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <SkeletonList count={4} />
      ) : packs.length === 0 ? (
        <EmptyState
          title="Nothing published yet"
          description="Publish a pack from My packs to list it here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {packs.map((pack) => (
            <li key={pack.id}>
              <Link
                href={`/dashboard/market/${pack.id}`}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors duration-150 hover:bg-[var(--color-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-medium text-foreground">{pack.name}</h2>
                  {pack.ownerId === owner?.id ? (
                    <Badge variant="primary">Yours</Badge>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {pack.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {pack.slug} · {pack.version}
                  </p>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
