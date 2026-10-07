"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { ConfigEditor } from "../../../../components/config/ConfigEditor";
import { getPack, type PackSummary } from "../../../../lib/packs";
import { parseConfig, type EditorConfig } from "../../../../lib/config-editor";

export default function PackPage() {
  const params = useParams<{ id: string }>();
  const [pack, setPack] = useState<PackSummary | null>(null);
  const [config, setConfig] = useState<EditorConfig | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPack(params.id)
      .then((next) => {
        setPack(next);
        const definition = next.definition ?? {
          commands: [],
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
  }, [params.id]);

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
        />
      ) : null}
    </DashboardShell>
  );
}
