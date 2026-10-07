"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { ErrorNote } from "../../../components/config/ui";
import { createPack, listOwnPacks, type PackSummary } from "../../../lib/packs";

export default function PacksPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listOwnPacks().then(setPacks).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load packs"));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const pack = await createPack({ name: name.trim(), slug: slug.trim() });
      router.push(`/dashboard/packs/${pack.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pack");
    }
  }

  return (
    <DashboardShell title="Packs">
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      <form onSubmit={onCreate} className="rounded-2xl border border-white/10 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
          <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug" required className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
        </div>
        <button type="submit" className="mt-3 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white">New pack</button>
      </form>
      <div className="mt-4 space-y-2">
        {packs.map((pack) => (
          <Link key={pack.id} href={`/dashboard/packs/${pack.id}`} className="block min-h-11 rounded-2xl border border-white/10 px-4 py-3 text-white">
            {pack.name} · {pack.slug}
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
