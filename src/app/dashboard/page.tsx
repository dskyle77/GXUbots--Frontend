"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard/Shell";
import { ErrorNote } from "../../components/config/ui";
import { createBot, listBots, type Bot } from "../../lib/bots";

function statusClass(status: Bot["status"]) {
  if (status === "linked" || status === "active") return "bg-primary/15 text-primary";
  return "bg-white/8 text-muted-foreground";
}

export default function DashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setError("");
    try {
      setBots(await listBots());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bots");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      const bot = await createBot(name.trim());
      router.push(`/dashboard/bots/${bot.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bot");
      setCreating(false);
    }
  }

  const linked = bots.filter((bot) => bot.linkedNumber || bot.status !== "inactive").length;

  return (
    <DashboardShell title="Bots">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-semibold text-white">{loading ? "—" : bots.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted-foreground">Linked</p>
          <p className="mt-1 text-2xl font-semibold text-white">{loading ? "—" : linked}</p>
        </div>
      </div>

      <form
        onSubmit={onCreate}
        className="mt-6 rounded-2xl border border-white/10 bg-card p-5 sm:p-6"
      >
        <h2 className="text-base font-semibold text-white">New bot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates an empty bot. Add packs after it is created.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={20}
            placeholder="Bot name"
            className="h-11 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={creating}
            className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create bot"}
          </button>
        </div>
      </form>

      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}

      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading bots...</p> : null}
        {!loading && bots.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-sm text-muted-foreground">
            No bots yet.
          </p>
        ) : null}
        {bots.map((bot) => (
          <Link
            key={bot.id}
            href={`/dashboard/bots/${bot.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card px-5 py-4 transition-colors hover:border-white/20"
          >
            <div>
              <p className="font-medium text-white">{bot.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {bot.linkedNumber ?? "No number linked"}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(bot.status)}`}>
              {bot.status}
            </span>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
