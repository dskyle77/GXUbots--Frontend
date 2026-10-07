"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { ErrorNote } from "../../../components/config/ui";
import { listMarketPacks } from "../../../lib/market";
import type { PackSummary } from "../../../lib/packs";
import { useAuth } from "../../../components/AuthProvider";

export default function MarketPage() {
  const { owner } = useAuth();
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMarketPacks()
      .then(setPacks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load the market"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Market">
      <p className="text-sm text-muted-foreground">Published packs. Installing one adds it to a bot you already have.</p>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {loading ? <p className="mt-6 text-sm text-muted-foreground">Loading packs...</p> : null}
      {!loading && packs.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-sm text-muted-foreground">Nothing published yet.</p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {packs.map((pack) => (
          <Link key={pack.id} href={`/dashboard/market/${pack.id}`} className="min-h-11 rounded-2xl border border-white/10 bg-card p-5 hover:border-white/20">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-medium text-white">{pack.name}</h2>
              {pack.ownerId === owner?.id ? <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">Yours</span> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{pack.description || "No description"}</p>
            <p className="mt-4 text-xs text-muted-foreground">{pack.slug} · {pack.version}</p>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
