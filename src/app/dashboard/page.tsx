"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { DashboardShell } from "../../components/dashboard/Shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/field";
import { Badge, StatusDot } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/empty-state";
import { SkeletonList } from "../../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { createBot, listBots, type Bot } from "../../lib/bots";

function botStatus(bot: Bot): "ok" | "warn" | "muted" {
  if (bot.linkedNumber || bot.status === "linked" || bot.status === "active") return "ok";
  return "muted";
}

export default function DashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

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
      setOpen(false);
      setName("");
      router.push(`/dashboard/bots/${bot.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bot");
      setCreating(false);
    }
  }

  const linked = bots.filter(
    (bot) => bot.linkedNumber || bot.status === "linked" || bot.status === "active",
  ).length;

  return (
    <DashboardShell
      title="Bots"
      description={
        loading
          ? "Loading…"
          : `${bots.length} bot${bots.length === 1 ? "" : "s"} · ${linked} linked`
      }
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New bot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreate}>
              <DialogHeader>
                <DialogTitle>New bot</DialogTitle>
                <DialogDescription>
                  Creates an empty bot. Add packs after it is created.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <Field label="Name">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={20}
                    placeholder="Bot name"
                    autoFocus
                  />
                </Field>
                {error ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={creating}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <SkeletonList count={4} />
      ) : bots.length === 0 ? (
        <EmptyState
          title="No bots yet"
          description="Create a bot, link WhatsApp, then install packs from Market or My packs."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New bot
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {bots.map((bot) => (
            <li key={bot.id}>
              <Link
                href={`/dashboard/bots/${bot.id}`}
                className="flex items-center gap-3 px-1 py-3.5 transition-colors duration-150 hover:bg-[var(--color-hover)]"
              >
                <StatusDot status={botStatus(bot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{bot.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {bot.linkedNumber ?? "Not linked"}
                  </p>
                </div>
                <Badge variant={botStatus(bot) === "ok" ? "success" : "default"}>
                  {bot.status}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
