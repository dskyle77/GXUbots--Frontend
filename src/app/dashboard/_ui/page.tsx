"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { DashboardShell } from "../../../components/dashboard/Shell";
import { Button } from "../../../components/ui/button";
import { Input, Textarea } from "../../../components/ui/input";
import { Field } from "../../../components/ui/field";
import { Badge, StatusDot } from "../../../components/ui/badge";
import { Switch } from "../../../components/ui/switch";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton, SkeletonList } from "../../../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { toast } from "../../../components/ui/toast";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border py-6 last:border-b-0">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function UiGalleryPage() {
  const [on, setOn] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <DashboardShell
      title="UI gallery"
      description="Dev-only component reference. Not linked in nav."
    >
      <p className="mb-2 text-xs text-muted-foreground">
        Prefer design tokens: <code className="font-mono text-foreground">border-border</code>,{" "}
        <code className="font-mono text-foreground">bg-[var(--color-inset)]</code>,{" "}
        <code className="font-mono text-foreground">text-muted-foreground</code>. Avoid{" "}
        <code className="font-mono">border-white/</code>, <code className="font-mono">bg-black/</code>,{" "}
        <code className="font-mono">text-[Npx]</code>.
      </p>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">
            <Plus className="size-4" />
            Small
          </Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-md gap-3">
          <Field label="Name">
            <Input placeholder="Bot name" />
          </Field>
          <Field label="Notes" hint="Optional">
            <Textarea placeholder="Description…" rows={3} />
          </Field>
        </div>
      </Section>

      <Section title="Badges & status">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <StatusDot status="ok" />
          <StatusDot status="warn" />
          <StatusDot status="muted" />
        </div>
      </Section>

      <Section title="Switch">
        <div className="flex items-center gap-3">
          <Switch checked={on} onCheckedChange={setOn} aria-label="Toggle demo" />
          <span className="text-sm text-muted-foreground">{on ? "On" : "Off"}</span>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Commands</TabsTrigger>
            <TabsTrigger value="b">Variables</TabsTrigger>
            <TabsTrigger value="c">Assets</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="mt-3 text-sm text-muted-foreground">
            Commands panel
          </TabsContent>
          <TabsContent value="b" className="mt-3 text-sm text-muted-foreground">
            Variables panel
          </TabsContent>
          <TabsContent value="c" className="mt-3 text-sm text-muted-foreground">
            Assets panel
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Dropdown menu (keyboard: ↑↓ Enter Esc)">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => toast("Edit")}>Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("Duplicate")}>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => toast("Delete")}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Dialog">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Example dialog</DialogTitle>
              <DialogDescription>Keyboard: Esc closes, Tab cycles focus.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="Skeletons">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 flex-1 max-w-xs" />
          </div>
          <SkeletonList count={3} />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="Nothing here"
          description="Placeholder empty state used across dashboard lists."
          action={<Button size="sm">Action</Button>}
        />
      </Section>

      <Section title="Toast">
        <Button variant="secondary" onClick={() => toast("Hello from the gallery")}>
          Fire toast
        </Button>
      </Section>
    </DashboardShell>
  );
}
