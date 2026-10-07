"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy route — packs live on the bot page Packs tab. */
export default function BotConfigRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/bots/${params.id}?tab=packs`);
  }, [params.id, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">Redirecting to Packs…</p>
    </main>
  );
}
