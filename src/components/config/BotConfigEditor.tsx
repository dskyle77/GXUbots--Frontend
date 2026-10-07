"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import {
  exposedVariables,
  getPack,
  installPack,
  listInstalledPacks,
  listOwnPacks,
  listPublicPacks,
  uninstallPack,
  updateInstalledPack,
  type ExposedVariable,
  type InstalledPack,
  type PackSummary,
} from "../../lib/packs";
import { groupExposed, updateAvailable } from "../../lib/pack-settings";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../ui/field";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { EmptyState } from "../ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "../ui/toast";

export function BotConfigEditor({ botId }: { botId: string }) {
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [settingsPack, setSettingsPack] = useState<PackSummary | null>(null);
  const [settingsInstalled, setSettingsInstalled] = useState<InstalledPack | null>(null);
  const [busy, setBusy] = useState("");

  async function reload() {
    setInstalled(await listInstalledPacks(botId));
  }

  useEffect(() => {
    reload().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load packs"),
    );
  }, [botId]);

  async function onInstall(pack: PackSummary) {
    setError("");
    setBusy(pack.id);
    try {
      const result = await installPack(
        botId,
        pack.id,
        pack.version === "draft" ? "draft" : undefined,
      );
      const sheets = await Promise.all(result.added.map((item) => getPack(item.packId)));
      setAdding(false);
      const withSettings = sheets.find((item) => exposedVariables(item).length > 0);
      if (withSettings) {
        setSettingsPack(withSettings);
        setSettingsInstalled(null);
      }
      await reload();
      toast.success(`Installed ${pack.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add pack");
    } finally {
      setBusy("");
    }
  }

  async function openSettings(pack: InstalledPack) {
    try {
      const full = await getPack(pack.packId);
      setSettingsPack(full);
      setSettingsInstalled(pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pack settings");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Install packs and configure the values they expose.
        </p>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add pack
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {installed.length === 0 ? (
        <EmptyState
          title="No packs installed"
          description="Add a pack from My packs or Market to give this bot commands."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add pack
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {installed.map((pack) => (
            <PackRow
              key={pack.packId}
              pack={pack}
              busy={busy === pack.packId}
              onUpdate={async () => {
                const target =
                  pack.version === "draft" ? "draft" : pack.latestVersion ?? undefined;
                if (!target) return;
                setBusy(pack.packId);
                try {
                  await updateInstalledPack(botId, pack.packId, { version: target });
                  await reload();
                  toast.success(
                    pack.version === "draft" ? "Draft reloaded" : `Updated to ${target}`,
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not update pack");
                } finally {
                  setBusy("");
                }
              }}
              onUninstall={async () => {
                setBusy(pack.packId);
                try {
                  await uninstallPack(botId, pack.packId);
                  await reload();
                  toast.success("Pack removed");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not remove pack");
                } finally {
                  setBusy("");
                }
              }}
              onSettings={() => void openSettings(pack)}
              onToggle={async (enabled) => {
                try {
                  await updateInstalledPack(botId, pack.packId, { enabled });
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not update pack");
                }
              }}
            />
          ))}
        </ul>
      )}

      <AddPackDialog
        open={adding}
        onOpenChange={setAdding}
        installed={installed}
        busy={busy}
        onPick={onInstall}
      />

      {settingsPack ? (
        <SettingsDialog
          botId={botId}
          pack={settingsPack}
          installed={settingsInstalled}
          onClose={() => {
            setSettingsPack(null);
            setSettingsInstalled(null);
          }}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}

function PackRow({
  pack,
  busy,
  onUpdate,
  onUninstall,
  onSettings,
  onToggle,
}: {
  pack: InstalledPack;
  busy: boolean;
  onUpdate: () => Promise<void>;
  onUninstall: () => Promise<void>;
  onSettings: () => void;
  onToggle: (enabled: boolean) => Promise<void>;
}) {
  const canUpdate = updateAvailable(pack.version, pack.latestVersion);
  const isDraft = pack.version === "draft";

  return (
    <li className="flex flex-wrap items-center gap-3 py-3.5 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{pack.name}</p>
          {canUpdate && !isDraft ? (
            <Badge variant="primary">Update {pack.latestVersion}</Badge>
          ) : null}
          {isDraft ? <Badge variant="primary">Draft</Badge> : null}
          {!pack.enabled ? <Badge>Disabled</Badge> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {pack.slug} · {pack.version}
          {typeof pack.priority === "number" ? ` · priority ${pack.priority}` : ""}
        </p>
      </div>

      <Switch
        checked={pack.enabled}
        disabled={busy}
        onCheckedChange={(checked) => void onToggle(checked)}
        aria-label={pack.enabled ? "Disable pack" : "Enable pack"}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="iconSm" disabled={busy} aria-label="Pack actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canUpdate ? (
            <DropdownMenuItem onSelect={() => void onUpdate()}>
              {isDraft ? "Reload draft" : `Update to ${pack.latestVersion}`}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onSettings}>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={() => void onUninstall()}>
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function AddPackDialog({
  open,
  onOpenChange,
  installed,
  busy,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installed: InstalledPack[];
  busy: string;
  onPick: (pack: PackSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    Promise.all([listOwnPacks(), listPublicPacks()])
      .then(([own, pub]) => {
        const seen = new Set<string>();
        setPacks(
          [...own, ...pub].filter((pack) => (seen.has(pack.id) ? false : (seen.add(pack.id), true))),
        );
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load packs"),
      );
  }, [open]);

  const installedIds = useMemo(
    () => new Set(installed.map((pack) => pack.packId)),
    [installed],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return packs.filter(
      (pack) =>
        !installedIds.has(pack.id) &&
        (!needle || `${pack.name} ${pack.slug}`.toLowerCase().includes(needle)),
    );
  }, [packs, query, installedIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add pack</DialogTitle>
          <DialogDescription>Search your packs and the public market.</DialogDescription>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search packs"
            className="pl-9"
            autoFocus
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto border-y border-border">
          {visible.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">No matching packs</li>
          ) : (
            visible.map((pack) => (
              <li key={pack.id}>
                <button
                  type="button"
                  disabled={busy === pack.id}
                  onClick={() => onPick(pack)}
                  className="flex w-full items-center justify-between gap-2 px-1 py-3 text-left text-sm transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{pack.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {pack.slug} · {pack.version}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-primary">Install</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({
  botId,
  pack,
  installed,
  onClose,
  onSaved,
}: {
  botId: string;
  pack: PackSummary;
  installed: InstalledPack | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const fields = exposedVariables(pack);
  const [values, setValues] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState(String(installed?.priority ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const base = Object.fromEntries(
      fields.map((field) => [field.name, field.default == null ? "" : String(field.default)]),
    );
    if (installed?.settings) {
      for (const [key, value] of Object.entries(installed.settings)) {
        base[key] = value == null ? "" : String(value);
      }
    }
    setValues(base);
    setPriority(String(installed?.priority ?? 0));
  }, [pack.id, installed?.packId]);

  async function save() {
    setSaving(true);
    try {
      await updateInstalledPack(botId, pack.id, {
        settings: coerce(fields, values),
        priority: Number(priority) || 0,
      });
      await onSaved();
      toast.success("Settings saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pack.name}</DialogTitle>
          <DialogDescription>Pack settings and priority.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-1">
          <Field label="Priority" hint="Higher runs first when triggers collide">
            <Input
              value={priority}
              inputMode="numeric"
              onChange={(event) => setPriority(event.target.value)}
            />
          </Field>
          {groupExposed(fields).map((group) => (
            <section key={group.label} className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              {group.fields.map((field) => (
                <SettingField
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(value) => setValues({ ...values, [field.name]: value })}
                />
              ))}
            </section>
          ))}
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">This pack has no exposed settings.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingField({
  field,
  value,
  onChange,
}: {
  field: ExposedVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={field.name} hint={field.type}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function coerce(
  fields: ExposedVariable[],
  values: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name] ?? "";
    if (field.type === "number") {
      const n = Number(raw);
      out[field.name] = Number.isFinite(n) ? n : 0;
    } else if (field.type === "boolean") {
      out[field.name] = raw === "true" || raw === "1";
    } else {
      out[field.name] = raw;
    }
  }
  return out;
}
