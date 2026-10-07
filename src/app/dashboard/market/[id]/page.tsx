"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { getMarketPack } from "../../../../lib/market";
import { installPack, type PackSummary } from "../../../../lib/packs";
import { listBots, type Bot } from "../../../../lib/bots";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Badge } from "../../../../components/ui/badge";
import { toast } from "../../../../components/ui/toast";

export default function MarketPackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pack, setPack] = useState<PackSummary | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getMarketPack(params.id), listBots()])
      .then(([nextPack, nextBots]) => {
        setPack(nextPack);
        setBots(nextBots);
        setBotId(nextBots[0]?.id ?? "");
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load pack"),
      );
  }, [params.id]);

  async function onInstall(event: FormEvent) {
    event.preventDefault();
    if (!pack || !botId) return;
    setBusy(true);
    setError("");
    try {
      await installPack(botId, pack.id, pack.version);
      toast.success("Pack installed");
      router.push(`/dashboard/bots/${botId}?tab=packs`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not install pack");
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      title={pack?.name ?? "Pack"}
      description={pack ? `${pack.slug} · ${pack.version}` : undefined}
      actions={
        <Link
          href="/dashboard/market"
          className="inline-flex h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Market
        </Link>
      }
    >
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!pack ? (
        <p className="text-sm text-muted-foreground">Loading pack…</p>
      ) : (
        <form onSubmit={onInstall} className="max-w-md space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{pack.visibility}</Badge>
              <Badge variant="default">{pack.version}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {pack.description || "No description"}
            </p>
          </div>

          <Field label="Install into bot">
            <select
              value={botId}
              onChange={(event) => setBotId(event.target.value)}
              className="flex h-11 w-full rounded-sm border border-border bg-[var(--color-inset)] px-3 text-sm text-foreground sm:h-9"
            >
              {bots.length === 0 ? (
                <option value="">Create a bot first</option>
              ) : null}
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
          </Field>

          <Button type="submit" disabled={!botId} loading={busy}>
            Install pack
          </Button>
        </form>
      )}
    </DashboardShell>
  );
}
