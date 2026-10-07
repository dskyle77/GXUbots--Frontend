"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";

const links = [
  { label: "Bots", href: "/dashboard" },
  { label: "My packs", href: "/dashboard/packs" },
  { label: "Market", href: "/dashboard/market" },
];

export function DashboardShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { owner, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !owner) router.replace("/login");
  }, [loading, owner, router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  if (loading || !owner) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-3 px-6">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-[var(--color-hover)]" />
        <div className="h-8 w-48 animate-pulse rounded-sm bg-[var(--color-hover)]" />
        <div className="mt-4 space-y-2">
          <div className="h-10 w-full max-w-md animate-pulse rounded-sm bg-[var(--color-hover)]" />
          <div className="h-10 w-full max-w-sm animate-pulse rounded-sm bg-[var(--color-hover)]" />
          <div className="h-10 w-full max-w-xs animate-pulse rounded-sm bg-[var(--color-hover)]" />
        </div>
      </main>
    );
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/bots");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const nav = (
    <>
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          GX
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">GXUbots</span>
      </Link>

      <nav className="mt-8 flex flex-col gap-0.5">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
              isActive(item.href)
                ? "bg-[var(--color-hover)] text-foreground"
                : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
        {owner.admin ? (
          <Link
            href="/dashboard/admin"
            className={cn(
              "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
              pathname.startsWith("/dashboard/admin")
                ? "bg-[var(--color-hover)] text-foreground"
                : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground",
            )}
          >
            Admin
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <p className="truncate text-sm font-medium text-foreground">{owner.name}</p>
        <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
            GX
          </div>
          <span className="font-semibold text-foreground">GXUbots</span>
        </Link>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/60"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-background p-5">
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="mx-auto grid min-h-[calc(100vh-3.25rem)] max-w-6xl md:min-h-screen md:grid-cols-[220px_1fr]">
        <aside className="hidden flex-col border-r border-border px-5 py-6 md:flex">{nav}</aside>

        <div className="px-4 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
