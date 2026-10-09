"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthProvider";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { ConfigEditor } from "../../../../components/config/ConfigEditor";
import { getPack, type PackSummary } from "../../../../lib/packs";
import { parseConfig, type EditorConfig } from "../../../../lib/config-editor";

export default function PackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { owner, loading: authLoading } = useAuth();
  const [pack, setPack] = useState<PackSummary | null>(null);
  const [config, setConfig] = useState<EditorConfig | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && owner && !owner.admin) {
      router.replace("/dashboard/market");
    }
  }, [authLoading, owner, router]);

  useEffect(() => {
    if (!owner?.admin) return;
    getPack(params.id)
      .then((next) => {
        setPack(next);
        const definition = next.definition ?? {
          events: [],
          functions: [],
          assets: [],
          variables: [],
        };
        setConfig(
          parseConfig(
            JSON.stringify({
              name: next.name,
              packs: [{ ...definition, name: next.name }],
            }),
            next.name,
          ),
        );
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load pack"),
      );
  }, [params.id, owner?.admin]);

  if (authLoading || (owner && !owner.admin)) {
    return (
      <DashboardShell title="Pack">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={pack?.name ?? "Pack"}
      description={pack ? `${pack.slug} · ${pack.version}` : undefined}
      actions={
        <Link
          href="/dashboard/packs"
          className="inline-flex h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          My packs
        </Link>
      }
      fill
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!config && !error ? (
        <p className="text-sm text-muted-foreground">Loading pack…</p>
      ) : null}
      {config && pack ? (
        <ConfigEditor
          packId={pack.id}
          initial={config}
          dependencies={pack.definition?.dependencies ?? []}
          initialVisibility={pack.visibility}
          initialPriceKobo={Number(pack.price_kobo ?? 0)}
          initialColor={pack.color?.trim() || "#8b5cf6"}
        />
      ) : null}
    </DashboardShell>
  );
}
