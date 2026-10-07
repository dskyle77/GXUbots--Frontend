import { api } from "./api";

export type Owner = {
  id: string;
  name: string;
  email: string;
  admin: boolean;
};

export type Session = {
  owner: Owner;
  expiresAt: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  name: string;
};

// The session token stays in an HttpOnly cookie set by the API.
// These calls only return the account, which is safe to keep in memory.

export function login(input: LoginInput) {
  return api<Session>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function register(input: RegisterInput) {
  return api<Session>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return api<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
}

export function getMe() {
  return api<Owner>("/api/auth/me");
}
