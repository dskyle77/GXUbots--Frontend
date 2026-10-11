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
  label?: string;
  description?: string;
  options?: string[];
};

export type PackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: string;
  ownerId: string;
  version: string;
  /** Latest published version when viewing own packs (primary version may still be "draft"). */
  publishedVersion?: string | null;
  /** Newest-first published version strings. */
  publishedVersions?: string[];
  /** Price in kobo; 0 = free */
  price_kobo?: number;
  /** Marketplace accent color */
  color?: string;
  exposedFunctions?: ExposedFunction[];
  exposedVariables?: ExposedVariable[];
  definition?: {
    dependencies?: { packId: string; version: string }[];
    events?: unknown[];
    variables?: ExposedVariable[];
    functions?: ExposedFunction[];
  };
};

/** Version to pin when adding as a dependency (never "draft"). */
export function dependencyVersion(pack: PackSummary): string | null {
  if (pack.publishedVersion && pack.publishedVersion !== "draft") return pack.publishedVersion;
  if (pack.version && pack.version !== "draft") return pack.version;
  return null;
}

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
  messageGroups?: { phase: string; handlerNames: string[] }[];
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

export type PackVersionInfo = {
  version: string;
  created_at: string;
  latest: boolean;
  installs: number;
  dependentCount: number;
  canDelete: boolean;
};

export function listPackVersions(id: string) {
  return api<PackVersionInfo[]>(`/api/packs/${id}/versions`);
}

export function deletePackVersion(id: string, version: string) {
  return api<PackVersionInfo[]>(`/api/packs/${id}/versions/${encodeURIComponent(version)}`, {
    method: "DELETE",
  });
}

export function updatePack(
  id: string,
  patch: {
    visibility?: string;
    description?: string;
    name?: string;
    price_kobo?: number;
    color?: string;
  },
) {
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


export function addPackDependency(packId: string, dep: { packId: string; version: string }) {
  return api<PackSummary>(`/api/packs/${packId}/dependencies`, {
    method: "POST",
    body: JSON.stringify(dep),
  });
}

export function removePackDependency(packId: string, depPackId: string) {
  return api<PackSummary>(`/api/packs/${packId}/dependencies/${depPackId}`, {
    method: "DELETE",
  });
}
