"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { ErrorNote } from "../../../../components/config/ui";
import { getMarketPack } from "../../../../lib/market";
import { installPack, type PackSummary } from "../../../../lib/packs";
import { listBots, type Bot } from "../../../../lib/bots";

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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load pack"));
  }, [params.id]);

  async function onInstall(event: FormEvent) {
    event.preventDefault();
    if (!pack || !botId) return;
    setBusy(true);
    setError("");
    try {
      await installPack(botId, pack.id, pack.version);
      router.push(`/dashboard/bots/${botId}/config`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not install pack");
      setBusy(false);
    }
  }

  return (
    <DashboardShell title={pack?.name ?? "Pack"}>
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {!pack ? <p className="text-sm text-muted-foreground">Loading pack...</p> : (
        <form onSubmit={onInstall} className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted-foreground">{pack.description || "No description"}</p>
          <p className="mt-2 text-xs text-muted-foreground">{pack.slug} · {pack.version}</p>
          <label className="mt-5 block text-sm text-white">
            Install into
            <select value={botId} onChange={(event) => setBotId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
              {bots.length === 0 ? <option value="">Create a bot first</option> : null}
              {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !botId} className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Installing..." : "Install pack"}
          </button>
        </form>
      )}
    </DashboardShell>
  );
}
