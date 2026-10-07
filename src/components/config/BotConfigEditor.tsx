"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorNote } from "./ui";
import { BottomSheet } from "./BottomSheet";
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

export function BotConfigEditor({ botId }: { botId: string }) {
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [settingsFor, setSettingsFor] = useState<PackSummary[]>([]);
  const [busy, setBusy] = useState("");

  async function reload() {
    setInstalled(await listInstalledPacks(botId));
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load packs"));
  }, [botId]);

  async function onInstall(pack: PackSummary) {
    setError("");
    setBusy(pack.id);
    try {
      const result = await installPack(botId, pack.id, pack.version === "draft" ? "draft" : undefined);
      const sheets = await Promise.all(result.added.map((item) => getPack(item.packId)));
      setAdding(false);
      setSettingsFor(sheets.filter((item) => exposedVariables(item).length > 0));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add pack");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <button type="button" onClick={() => setAdding(true)} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
        Add pack
      </button>
      {installed.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-muted-foreground">No packs installed.</p>
      ) : null}
      {installed.map((pack) => (
        <PackRow
          key={pack.packId}
          pack={pack}
          busy={busy === pack.packId}
          onError={setError}
          onChange={reload}
          onUninstall={async () => {
            setBusy(pack.packId);
            try {
              await uninstallPack(botId, pack.packId);
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove pack");
            } finally {
              setBusy("");
            }
          }}
          onUpdate={async () => {
            const target =
              pack.version === "draft" ? "draft" : pack.latestVersion ?? undefined;
            if (!target) return;
            setBusy(pack.packId);
            try {
              await updateInstalledPack(botId, pack.packId, { version: target });
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update pack");
            } finally {
              setBusy("");
            }
          }}
        />
      ))}
      {adding ? <AddPackSheet botId={botId} installed={installed} busy={busy} onClose={() => setAdding(false)} onPick={onInstall} /> : null}
      {settingsFor.length > 0 ? (
        <SettingsSheet
          botId={botId}
          packs={settingsFor}
          onClose={() => setSettingsFor([])}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}

function PackRow({
  pack,
  busy,
  onUninstall,
  onUpdate,
}: {
  pack: InstalledPack;
  busy: boolean;
  onError: (message: string) => void;
  onChange: () => Promise<void>;
  onUninstall: () => Promise<void>;
  onUpdate: () => Promise<void>;
}) {
  const canUpdate = updateAvailable(pack.version, pack.latestVersion);
  const isDraft = pack.version === "draft";
  const updateLabel = isDraft
    ? "Reload draft"
    : canUpdate
      ? `Update ${pack.latestVersion}`
      : "Up to date";
  return (
    <article className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium text-white">{pack.name}</h2>
          <p className="text-sm text-muted-foreground">{pack.slug} · {pack.version}</p>
        </div>
        {canUpdate && !isDraft ? (
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
            Update {pack.latestVersion}
          </span>
        ) : null}
        {isDraft ? (
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
            Draft — reload after save
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || (!canUpdate && !isDraft)} onClick={() => void onUpdate()} className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white disabled:opacity-40">
          {updateLabel}
        </button>
        <button type="button" disabled={busy} onClick={() => void onUninstall()} className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white">
          Remove
        </button>
      </div>
      <PackControls pack={pack} />
    </article>
  );
}

function PackControls({ pack }: { pack: InstalledPack }) {
  const [enabled, setEnabled] = useState(pack.enabled);
  const [priority, setPriority] = useState(String(pack.priority));
  useEffect(() => {
    setEnabled(pack.enabled);
    setPriority(String(pack.priority));
  }, [pack.enabled, pack.priority]);
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          void updateInstalledPack(pack.botId, pack.packId, { enabled: next });
        }}
        className="min-h-11 rounded-lg border border-white/10 px-3 text-left text-sm text-white"
      >
        {enabled ? "Enabled" : "Disabled"}
      </button>
      <label className="block text-xs text-muted-foreground">
        Priority
        <input
          value={priority}
          inputMode="numeric"
          onChange={(event) => setPriority(event.target.value)}
          onBlur={() => void updateInstalledPack(pack.botId, pack.packId, { priority: Number(priority) || 0 })}
          className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"
        />
      </label>
    </div>
  );
}

function AddPackSheet({
  installed,
  busy,
  onClose,
  onPick,
}: {
  botId: string;
  installed: InstalledPack[];
  busy: string;
  onClose: () => void;
  onPick: (pack: PackSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([listOwnPacks(), listPublicPacks()])
      .then(([own, pub]) => {
        const seen = new Set<string>();
        setPacks([...own, ...pub].filter((pack) => (seen.has(pack.id) ? false : seen.add(pack.id))));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load packs"));
  }, []);
  const installedIds = new Set(installed.map((pack) => pack.packId));
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return packs.filter((pack) => !installedIds.has(pack.id) && (!needle || `${pack.name} ${pack.slug}`.toLowerCase().includes(needle)));
  }, [packs, query, installed]);
  return (
    <BottomSheet title="Add pack" onClose={onClose}>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search packs" className="min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
      <div className="mt-3 space-y-2">
        {visible.map((pack) => (
          <button key={pack.id} type="button" disabled={busy === pack.id} onClick={() => onPick(pack)} className="min-h-11 w-full rounded-lg border border-white/10 px-3 text-left text-sm text-white">
            {pack.name} · {pack.slug} · {pack.version}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

function SettingsSheet({
  botId,
  packs,
  onClose,
  onSaved,
}: {
  botId: string;
  packs: PackSummary[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const pack = packs[index];
  const fields = pack ? exposedVariables(pack) : [];
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setValues(Object.fromEntries(fields.map((field) => [field.name, field.default == null ? "" : String(field.default)])));
  }, [pack?.id]);
  if (!pack) return null;
  return (
    <BottomSheet title={`Settings · ${pack.name}`} onClose={onClose}>
      {groupExposed(fields).map((group) => (
        <section key={group.label} className="mb-4">
          <h3 className="text-sm font-medium text-white">{group.label}</h3>
          {group.fields.map((field) => (
            <Field key={field.name} field={field} value={values[field.name] ?? ""} onChange={(value) => setValues({ ...values, [field.name]: value })} />
          ))}
        </section>
      ))}
      <button
        type="button"
        className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
        onClick={() => {
          void updateInstalledPack(botId, pack.id, { settings: coerce(fields, values) }).then(async () => {
            if (index + 1 < packs.length) setIndex(index + 1);
            else {
              await onSaved();
              onClose();
            }
          });
        }}
      >
        {index + 1 < packs.length ? "Next pack" : "Save"}
      </button>
    </BottomSheet>
  );
}

function Field({ field, value, onChange }: { field: ExposedVariable; value: string; onChange: (value: string) => void }) {
  if (field.type === "boolean") {
    const on = value === "true";
    return (
      <button type="button" onClick={() => onChange(on ? "false" : "true")} className="mt-2 min-h-11 w-full rounded-lg border border-white/10 px-3 text-left text-sm text-white">
        {field.name}: {on ? "On" : "Off"}
      </button>
    );
  }
  return (
    <label className="mt-2 block text-xs text-muted-foreground">
      {field.name}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
    </label>
  );
}

function coerce(fields: ExposedVariable[], values: Record<string, string>) {
  const settings: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name] ?? "";
    if (field.type === "number") settings[field.name] = Number(raw);
    else if (field.type === "boolean") settings[field.name] = raw === "true";
    else settings[field.name] = raw;
  }
  return settings;
}
