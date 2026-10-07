import { api } from "./api";

export type BotStatus = "active" | "inactive" | "linked";
export type ConnectionStatus = "connecting" | "open" | "closed";
export type LinkMethod = "qr" | "pairing-code";

export type Bot = {
  id: string;
  name: string;
  ownerId: string;
  description: string;
  status: BotStatus;
  linkedNumber: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BotConnection = {
  id: string;
  name: string;
  status: BotStatus;
  linkedNumber: string | null;
  connection: ConnectionStatus;
  runtimeLoaded: boolean;
};

export type LinkResult = {
  method: LinkMethod;
  qr?: string;
  pairingCode?: string;
};

export function listBots() {
  return api<Bot[]>("/api/bots");
}

export function getBot(id: string) {
  return api<Bot>(`/api/bots/${id}`);
}

export function createBot(name: string) {
  return api<Bot>("/api/bots/create", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameBot(id: string, name: string) {
  return api<Bot>(`/api/bots/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteBot(id: string) {
  return api<{ id: string; deleted: boolean }>(`/api/bots/${id}`, {
    method: "DELETE",
  });
}

export function getBotStatus(id: string) {
  return api<BotConnection>(`/api/bots/${id}/status`);
}

export function linkBot(id: string, method: LinkMethod, phoneNumber?: string) {
  return api<LinkResult>(`/api/bots/${id}/link`, {
    method: "PUT",
    body: JSON.stringify({
      method,
      ...(phoneNumber ? { phoneNumber } : {}),
    }),
  });
}

export function unlinkBot(id: string) {
  return api<Bot>(`/api/bots/${id}/link`, { method: "DELETE" });
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}
