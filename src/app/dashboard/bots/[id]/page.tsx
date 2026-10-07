"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { BotConfigEditor } from "../../../../components/config/BotConfigEditor";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Field } from "../../../../components/ui/field";
import { Badge, StatusDot } from "../../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { toast } from "../../../../components/ui/toast";

function connectionDot(status: BotConnection | null, linked: boolean): "ok" | "warn" | "muted" {
  if (status?.connection === "open" || linked) return "ok";
  if (status?.connection === "connecting") return "warn";
  return "muted";
}

export default function BotPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const id = params.id;

  const initialTab =
    search.get("tab") === "packs" || search.get("tab") === "settings"
      ? (search.get("tab") as "packs" | "settings")
      : "overview";

  const [tab, setTab] = useState(initialTab);
  const [bot, setBot] = useState<Bot | null>(null);
  const [status, setStatus] = useState<BotConnection | null>(null);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<LinkMethod>("qr");
  const [phone, setPhone] = useState("");
  const [link, setLink] = useState<LinkResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

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
      toast.success("Bot renamed");
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
      setConfirmUnlink(false);
      toast.success("WhatsApp unlinked");
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
    <DashboardShell
      title={bot?.name ?? "Bot"}
      description={
        bot
          ? bot.linkedNumber
            ? `Linked · ${bot.linkedNumber}`
            : "Not linked to WhatsApp"
          : undefined
      }
      actions={
        bot ? (
          <div className="flex items-center gap-2">
            <StatusDot status={connectionDot(status, linked)} />
            <Badge variant={linked ? "success" : "default"}>{bot.status}</Badge>
            {status?.runtimeLoaded ? <Badge variant="primary">Runtime</Badge> : null}
          </div>
        ) : null
      }
    >
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {!bot ? (
        <p className="text-sm text-muted-foreground">Loading bot…</p>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as typeof tab);
            const next =
              value === "overview"
                ? `/dashboard/bots/${id}`
                : `/dashboard/bots/${id}?tab=${value}`;
            router.replace(next, { scroll: false });
          }}
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="packs">Packs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <section>
              <h2 className="text-sm font-medium text-foreground">WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connection: {status?.connection ?? "closed"}
                {status?.runtimeLoaded ? " · runtime loaded" : ""}
              </p>

              {linked ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    Linked as <span className="text-foreground">{bot.linkedNumber}</span>
                  </p>
                  <Button variant="secondary" onClick={() => setConfirmUnlink(true)}>
                    Unlink
                  </Button>
                </div>
              ) : (
                <form onSubmit={onLink} className="mt-4 max-w-md space-y-4">
                  <div className="flex gap-2">
                    {(["qr", "pairing-code"] as LinkMethod[]).map((item) => (
                      <Button
                        key={item}
                        type="button"
                        size="sm"
                        variant={method === item ? "primary" : "secondary"}
                        onClick={() => setMethod(item)}
                      >
                        {item === "qr" ? "QR code" : "Pairing code"}
                      </Button>
                    ))}
                  </div>
                  {method === "pairing-code" ? (
                    <Field label="Phone number" hint="Country code + number, digits only">
                      <Input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        required
                        inputMode="numeric"
                        placeholder="2348012345678"
                      />
                    </Field>
                  ) : null}
                  <Button type="submit" loading={busy === "link"}>
                    Link WhatsApp
                  </Button>
                </form>
              )}

              {link?.pairingCode ? (
                <p className="mt-6 text-center font-mono text-3xl font-semibold tracking-[0.3em] text-foreground">
                  {link.pairingCode}
                </p>
              ) : null}
              {qr ? (
                <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div
                    className="w-52 shrink-0 overflow-hidden rounded-lg bg-white p-3"
                    dangerouslySetInnerHTML={{ __html: qr }}
                  />
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Open WhatsApp → Linked devices → Link a device, then scan this code. If it
                    expires, start linking again.
                  </p>
                </div>
              ) : null}
              {link && !qr && !link.pairingCode ? (
                <p className="mt-3 text-sm text-muted-foreground">Waiting for the phone to connect…</p>
              ) : null}
            </section>
          </TabsContent>

          <TabsContent value="packs">
            <BotConfigEditor botId={id} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-10">
            <section className="max-w-md">
              <h2 className="text-sm font-medium text-foreground">Name</h2>
              <form onSubmit={onRename} className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={20}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  loading={busy === "rename"}
                  disabled={name.trim() === bot.name}
                >
                  Save
                </Button>
              </form>
            </section>

            <section className="max-w-md border-t border-border pt-8">
              <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deleting a bot removes its packs, link, and runtime state. This cannot be undone.
              </p>
              <Button
                variant="dangerOutline"
                className="mt-4"
                onClick={() => setConfirmDelete(true)}
              >
                Delete bot
              </Button>
            </section>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink WhatsApp?</DialogTitle>
            <DialogDescription>
              The bot will stop receiving messages until you link a number again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmUnlink(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === "unlink"} onClick={() => void onUnlink()}>
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this bot?</DialogTitle>
            <DialogDescription>
              Permanently delete {bot?.name}. Installed packs and the WhatsApp session are removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === "delete"} onClick={() => void onDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
