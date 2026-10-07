"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";

const links = [
  { label: "Bots", href: "/dashboard" },
  { label: "Packs", href: "/dashboard/packs" },
  { label: "Market", href: "/dashboard/market" },
];

export function DashboardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { owner, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !owner) router.replace("/login");
  }, [loading, owner, router]);

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  if (loading || !owner) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl md:grid-cols-[220px_1fr]">
        <aside className="border-b border-white/5 px-6 py-6 md:border-b-0 md:border-r">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              GX
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">GXUbots</span>
          </Link>

          <nav className="mt-8 flex gap-2 md:flex-col">
            {links.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname.startsWith("/dashboard/bots")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-white/8 text-white"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {owner.admin ? (
              <Link
                href="/dashboard/admin"
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith("/dashboard/admin")
                    ? "bg-white/8 text-white"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
              >
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="mt-8 border-t border-white/5 pt-4 md:mt-10">
            <p className="truncate text-sm font-medium text-white">{owner.name}</p>
            <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="mt-3 text-sm text-muted-foreground transition-colors hover:text-white"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="px-6 py-8 sm:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
