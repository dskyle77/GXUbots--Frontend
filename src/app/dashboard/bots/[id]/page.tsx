"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import {
  deleteBot,
  getBot,
  getBotStatus,
  linkBot,
  normalizePhone,
  renameBot,
  unlinkBot,
  type Bot,
  type BotConnection,
  type LinkMethod,
  type LinkResult,
} from "../../../../lib/bots";
import { qrSvg } from "../../../../lib/qr";

export default function BotPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [bot, setBot] = useState<Bot | null>(null);
  const [status, setStatus] = useState<BotConnection | null>(null);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<LinkMethod>("qr");
  const [phone, setPhone] = useState("");
  const [link, setLink] = useState<LinkResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    const [nextBot, nextStatus] = await Promise.all([getBot(id), getBotStatus(id)]);
    setBot(nextBot);
    setStatus(nextStatus);
    setName(nextBot.name);
    if (nextStatus.connection === "open" || nextStatus.linkedNumber) setLink(null);
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    Promise.all([getBot(id), getBotStatus(id)])
      .then(([nextBot, nextStatus]) => {
        if (cancelled) return;
        setBot(nextBot);
        setStatus(nextStatus);
        setName(nextBot.name);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load bot");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!link && status?.connection !== "connecting") return;
    const timer = window.setInterval(() => {
      void getBotStatus(id)
        .then((next) => {
          setStatus(next);
          if (next.connection === "open" || next.linkedNumber) {
            setLink(null);
            return getBot(id).then(setBot);
          }
          return undefined;
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [id, link, status?.connection]);

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy("rename");
    try {
      const next = await renameBot(id, name.trim());
      setBot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename bot");
    } finally {
      setBusy("");
    }
  }

  async function onLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy("link");
    try {
      const phoneNumber = method === "pairing-code" ? normalizePhone(phone) : undefined;
      setLink(await linkBot(id, method, phoneNumber));
      setStatus(await getBotStatus(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start linking");
    } finally {
      setBusy("");
    }
  }

  async function onUnlink() {
    setError("");
    setBusy("unlink");
    try {
      const next = await unlinkBot(id);
      setBot(next);
      setLink(null);
      setStatus(await getBotStatus(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink bot");
    } finally {
      setBusy("");
    }
  }

  async function onDelete() {
    setError("");
    setBusy("delete");
    try {
      await deleteBot(id);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete bot");
      setBusy("");
    }
  }

  const qr = link?.qr ? qrSvg(link.qr) : null;
  const linked = Boolean(bot?.linkedNumber);

  return (
    <DashboardShell title={bot?.name ?? "Bot"}>
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!bot ? (
        <p className="text-sm text-muted-foreground">Loading bot...</p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/8 px-2.5 py-1 text-muted-foreground">{bot.status}</span>
              <span className="rounded-full bg-white/8 px-2.5 py-1 text-muted-foreground">
                {status?.connection ?? "closed"}
              </span>
              {status?.runtimeLoaded ? (
                <span className="rounded-full bg-primary/15 px-2.5 py-1 text-primary">runtime loaded</span>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {bot.linkedNumber ? `Linked number ${bot.linkedNumber}` : "No number linked"}
            </p>

            <form onSubmit={onRename} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={20}
                className="h-11 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={busy === "rename" || name.trim() === bot.name}
                className="h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "rename" ? "Saving..." : "Rename"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-white">WhatsApp</h2>
            {linked ? (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  This bot is linked. Unlink before connecting a different number.
                </p>
                <button
                  type="button"
                  onClick={() => void onUnlink()}
                  disabled={busy === "unlink"}
                  className="mt-4 h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  {busy === "unlink" ? "Unlinking..." : "Unlink number"}
                </button>
              </div>
            ) : (
              <form onSubmit={onLink} className="mt-4 space-y-4">
                <div className="flex gap-2">
                  {(["qr", "pairing-code"] as LinkMethod[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMethod(item)}
                      className={`h-10 rounded-lg px-3 text-sm ${
                        method === item
                          ? "bg-primary text-white"
                          : "border border-white/10 text-muted-foreground"
                      }`}
                    >
                      {item === "qr" ? "QR code" : "Pairing code"}
                    </button>
                  ))}
                </div>
                {method === "pairing-code" ? (
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    inputMode="numeric"
                    placeholder="2348012345678"
                    className="h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={busy === "link"}
                  className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy === "link" ? "Starting..." : "Link WhatsApp"}
                </button>
              </form>
            )}

            {link?.pairingCode ? (
              <p className="mt-5 text-center text-3xl font-semibold tracking-[0.3em] text-white">
                {link.pairingCode}
              </p>
            ) : null}
            {qr ? (
              <div
                className="mx-auto mt-5 w-56 overflow-hidden rounded-xl bg-white p-3"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : null}
            {link ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Waiting for the phone to connect. If this expires, start linking again.
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-white">Config</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit commands, events, functions, assets, and variables.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{bot.description || "No description"}</p>
            <Link
              href={`/dashboard/bots/${id}/config`}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Packs
            </Link>
          </section>

          <section className="rounded-2xl border border-destructive/30 bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-white">Delete bot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This removes the bot, its saved state, and the WhatsApp session.
            </p>
            {confirmDelete ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  disabled={busy === "delete"}
                  className="h-11 rounded-lg bg-destructive px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy === "delete" ? "Deleting..." : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="h-11 rounded-lg border border-white/10 px-4 text-sm text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="mt-4 h-11 rounded-lg border border-destructive/40 px-4 text-sm font-semibold text-destructive"
              >
                Delete bot
              </button>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
