"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { useAuth } from "../../../components/AuthProvider";

export default function AdminPage() {
  const router = useRouter();
  const { owner, loading } = useAuth();

  useEffect(() => {
    if (!loading && owner && !owner.admin) router.replace("/dashboard");
  }, [loading, owner, router]);

  if (!owner?.admin) return null;

  return (
    <DashboardShell title="Admin">
      <p className="text-sm text-muted-foreground">Publishing a pack is done from the pack editor. Bots no longer copy a template.</p>
    </DashboardShell>
  );
}
