import { api } from "./api";
import type { PackSummary } from "./packs";

export function listMarketPacks() {
  return api<PackSummary[]>("/api/packs/public");
}

export function getMarketPack(id: string) {
  return api<PackSummary>(`/api/packs/${id}`);
}
