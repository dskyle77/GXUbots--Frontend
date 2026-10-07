"use client";

import { DashboardShell } from "../../../../../components/dashboard/Shell";
import { BotConfigEditor } from "../../../../../components/config/BotConfigEditor";
import { useParams } from "next/navigation";

export default function BotConfigPage() {
  const params = useParams<{ id: string }>();
  return (
    <DashboardShell title="Packs">
      <p className="mb-4 text-sm text-muted-foreground">Install packs and set the values they expose. Pack internals are edited in the pack editor.</p>
      <BotConfigEditor botId={params.id} />
    </DashboardShell>
  );
}
