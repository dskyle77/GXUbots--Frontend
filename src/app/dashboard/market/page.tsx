"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { listMarketPacks } from "../../../lib/market";
import type { PackSummary } from "../../../lib/packs";
import { formatNgn } from "../../../lib/billing";
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
      description="Install packs on your bots. Configure their settings after install."
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
          description={
            owner?.admin
              ? "Publish a pack from My packs to list it here."
              : "Check back soon for packs you can install."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {packs.map((pack) => {
            const price = Number(pack.price_kobo ?? 0);
            const color = pack.color?.trim() || undefined;
            return (
              <li key={pack.id}>
                <Link
                  href={`/dashboard/market/${pack.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150 hover:bg-[var(--color-hover)]"
                >
                  <div
                    className="h-1.5 w-full"
                    style={{ background: color || "var(--color-primary, #8b5cf6)" }}
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-sm font-medium text-foreground">{pack.name}</h2>
                      <Badge variant={price > 0 ? "primary" : "default"}>
                        {price > 0 ? formatNgn(price) : "Free"}
                      </Badge>
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
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
