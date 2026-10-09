"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { getMarketPack } from "../../../../lib/market";
import { installPack, type PackSummary } from "../../../../lib/packs";
import {
  formatNgn,
  getEntitlement,
  initializePurchase,
  mockCompletePurchase,
} from "../../../../lib/billing";
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
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getMarketPack(params.id), listBots(), getEntitlement(params.id).catch(() => ({ owned: false }))])
      .then(([nextPack, nextBots, ent]) => {
        setPack(nextPack);
        setBots(nextBots);
        setBotId(nextBots[0]?.id ?? "");
        setOwned(ent.owned || Number(nextPack.price_kobo ?? 0) <= 0);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load pack"),
      );
  }, [params.id]);

  const price = Number(pack?.price_kobo ?? 0);
  const isPaid = price > 0;

  async function ensureOwned(): Promise<boolean> {
    if (!pack) return false;
    if (!isPaid || owned) return true;
    const init = await initializePurchase(pack.id);
    if ("free" in init && init.free) {
      setOwned(true);
      return true;
    }
    if ("alreadyOwned" in init && init.alreadyOwned) {
      setOwned(true);
      return true;
    }
    if ("mode" in init && init.mode === "mock" && init.reference) {
      // Mock Paystack: complete immediately in-flow
      await mockCompletePurchase(init.reference);
      setOwned(true);
      toast.success("Mock payment successful");
      return true;
    }
    throw new Error("Could not complete purchase");
  }

  async function onInstall(event: FormEvent) {
    event.preventDefault();
    if (!pack || !botId) return;
    setBusy(true);
    setError("");
    try {
      await ensureOwned();
      await installPack(botId, pack.id);
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
          <div
            className="h-1.5 w-full rounded-full"
            style={{
              background: pack.color?.trim() || "var(--color-primary, #8b5cf6)",
            }}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isPaid ? "primary" : "default"}>
                {isPaid ? formatNgn(price) : "Free"}
              </Badge>
              <Badge>{pack.version}</Badge>
              {owned && isPaid ? <Badge>Owned</Badge> : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {pack.description || "No description"}
            </p>
            {isPaid && !owned ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Payments run in mock mode until Paystack keys are configured.
              </p>
            ) : null}
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
            {isPaid && !owned ? `Pay ${formatNgn(price)} & install` : "Install pack"}
          </Button>
        </form>
      )}
    </DashboardShell>
  );
}
