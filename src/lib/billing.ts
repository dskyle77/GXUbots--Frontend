import { api } from "./api";

export type InitPurchaseResult =
  | { free: true; packId: string; alreadyOwned: boolean }
  | {
      free: false;
      alreadyOwned: true;
      packId: string;
      amount_kobo: number;
      currency: string;
    }
  | {
      free: false;
      alreadyOwned: false;
      mode: "mock";
      packId: string;
      amount_kobo: number;
      currency: string;
      reference: string;
      authorization_url: string;
    };

export function initializePurchase(packId: string) {
  return api<InitPurchaseResult>("/api/billing/initialize", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
}

export function mockCompletePurchase(reference: string) {
  return api<{ reference: string; status: string; packId: string }>("/api/billing/mock-complete", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

export function getEntitlement(packId: string) {
  return api<{ owned: boolean }>(`/api/billing/entitlements/${packId}`);
}

export function formatNgn(kobo: number) {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(naira);
}
