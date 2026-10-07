"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/Shell";
import { ConfigEditor } from "../../../../components/config/ConfigEditor";
import { ErrorNote } from "../../../../components/config/ui";
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
        const definition = next.definition ?? { commands: [], functions: [], assets: [], variables: [] };
        setConfig(parseConfig(JSON.stringify({ name: next.name, packs: [{ ...definition, name: next.name }] }), next.name));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load pack"));
  }, [params.id]);

  return (
    <DashboardShell title={pack?.name ?? "Pack"}>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!config && !error ? <p className="text-sm text-muted-foreground">Loading pack...</p> : null}
      {config && pack ? (
        <ConfigEditor packId={pack.id} initial={config} dependencies={pack.definition?.dependencies ?? []} />
      ) : null}
    </DashboardShell>
  );
}
