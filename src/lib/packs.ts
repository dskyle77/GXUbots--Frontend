import { api } from "./api";

export type ExposedFunction = {
  name: string;
  kind: "action" | "value";
  exposed?: boolean;
  parameters: { name: string; type: string }[];
};

export type ExposedVariable = {
  name: string;
  scope: string;
  type: string;
  group: string;
  default: unknown;
  expose?: boolean;
};

export type PackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: string;
  ownerId: string;
  version: string;
  exposedFunctions?: ExposedFunction[];
  exposedVariables?: ExposedVariable[];
  definition?: {
    dependencies?: { packId: string; version: string }[];
    variables?: ExposedVariable[];
    functions?: ExposedFunction[];
  };
};

export type InstalledPack = {
  botId: string;
  packId: string;
  version: string;
  enabled: boolean;
  priority: number;
  settings: Record<string, unknown>;
  slug: string;
  name: string;
  latestVersion: string | null;
};

export function createPack(input: { slug: string; name: string; description?: string; visibility?: string }) {
  return api<PackSummary>("/api/packs", { method: "POST", body: JSON.stringify(input) });
}

export function saveDraft(id: string, definition: unknown) {
  return api<PackSummary>(`/api/packs/${id}/draft`, { method: "PUT", body: JSON.stringify(definition) });
}

export function publishPack(id: string, version: string) {
  return api<PackSummary>(`/api/packs/${id}/publish`, { method: "POST", body: JSON.stringify({ version }) });
}

export function updatePack(id: string, patch: { visibility?: string; description?: string; name?: string }) {
  return api<PackSummary>(`/api/packs/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function listOwnPacks() {
  return api<PackSummary[]>("/api/packs");
}

export function listPublicPacks() {
  return api<PackSummary[]>("/api/packs/public");
}

export function getPack(id: string) {
  return api<PackSummary>(`/api/packs/${id}`);
}

export function listInstalledPacks(botId: string) {
  return api<InstalledPack[]>(`/api/bots/${botId}/packs`);
}

export function installPack(botId: string, packId: string, version?: string) {
  return api<{ added: { packId: string; slug: string; version: string }[] }>(`/api/bots/${botId}/packs`, {
    method: "POST",
    body: JSON.stringify({ packId, ...(version ? { version } : {}) }),
  });
}

export function updateInstalledPack(
  botId: string,
  packId: string,
  patch: { version?: string; enabled?: boolean; priority?: number; settings?: Record<string, unknown> },
) {
  return api<InstalledPack>(`/api/bots/${botId}/packs/${packId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function uninstallPack(botId: string, packId: string) {
  return api<{ packId: string; deleted: boolean }>(`/api/bots/${botId}/packs/${packId}`, { method: "DELETE" });
}

export function exposedVariables(pack: PackSummary): ExposedVariable[] {
  if (pack.exposedVariables) return pack.exposedVariables;
  return (pack.definition?.variables ?? []).filter((variable) => variable.expose);
}
