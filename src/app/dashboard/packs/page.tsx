"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { createPack, listOwnPacks, type PackSummary } from "../../../lib/packs";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Field } from "../../../components/ui/field";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { SkeletonList } from "../../../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function PacksPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listOwnPacks()
      .then(setPacks)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load packs"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      const pack = await createPack({
        name: name.trim(),
        slug: (slug.trim() || slugify(name)).trim(),
      });
      setOpen(false);
      router.push(`/dashboard/packs/${pack.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pack");
      setCreating(false);
    }
  }

  return (
    <DashboardShell
      title="My packs"
      description={
        loading
          ? "Loading…"
          : `${packs.length} pack${packs.length === 1 ? "" : "s"} you author`
      }
      actions={
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setName("");
              setSlug("");
              setSlugTouched(false);
              setError("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New pack
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreate}>
              <DialogHeader>
                <DialogTitle>New pack</DialogTitle>
                <DialogDescription>
                  A pack holds commands, functions, variables, and assets you can install on bots.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                <Field label="Name">
                  <Input
                    value={name}
                    onChange={(event) => {
                      const next = event.target.value;
                      setName(next);
                      if (!slugTouched) setSlug(slugify(next));
                    }}
                    required
                    placeholder="Moderation tools"
                    autoFocus
                  />
                </Field>
                <Field label="Slug" hint="Unique URL id; hard to change after publish">
                  <Input
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                    }}
                    required
                    placeholder="moderation-tools"
                    className="font-mono"
                  />
                </Field>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={creating}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <SkeletonList count={4} />
      ) : packs.length === 0 ? (
        <EmptyState
          title="No packs yet"
          description="Create a pack, edit commands in the editor, then install it on a bot."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New pack
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {packs.map((pack) => (
            <li key={pack.id}>
              <Link
                href={`/dashboard/packs/${pack.id}`}
                className="flex items-center gap-3 px-1 py-3.5 transition-colors duration-150 hover:bg-[var(--color-hover)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{pack.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{pack.slug}</p>
                </div>
                <Badge variant={pack.visibility === "public" ? "primary" : "default"}>
                  {pack.visibility ?? "private"}
                </Badge>
                <Badge variant="default">{pack.version}</Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
