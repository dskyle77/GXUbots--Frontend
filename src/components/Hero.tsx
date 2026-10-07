import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-125 w-200 -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          {/* Content */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Build bots. Your way.
            </div>

            <h1 className="max-w-3xl text-5xl font-bold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Create bots for{" "}
              <span className="gxu-gradient-text">almost anything.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Build, customize, and run powerful WhatsApp bots without being
              locked into a single use case.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-gxu-sm"
              >
                Create a bot
              </Link>

              <Link
                href="/dashboard/market"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/3 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/6"
              >
                Explore packs
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span>Quiz bots</span>
              <span>Community bots</span>
              <span>Games</span>
              <span>Business bots</span>
            </div>
          </div>

          {/* Product Preview */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-3xl" />

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl">
              {/* Window bar */}
              <div className="flex h-11 items-center border-b border-white/5 px-4">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                </div>

                <div className="mx-auto rounded-md border border-white/5 bg-white/2 px-3 py-1 text-[10px] text-muted-foreground">
                  app.gxubots.com
                </div>

                <div className="w-10" />
              </div>

              <div className="grid min-h-95 grid-cols-[130px_1fr]">
                {/* Sidebar */}
                <aside className="border-r border-white/5 p-3">
                  <div className="mb-5 px-2 text-xs font-semibold text-white">
                    GXUbots
                  </div>

                  <div className="space-y-1">
                    {["Overview", "My Bots", "Templates", "Assets"].map(
                      (item, index) => (
                        <div
                          key={item}
                          className={`rounded-md px-2.5 py-2 text-[11px] ${
                            index === 1
                              ? "bg-primary/10 font-medium text-white"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item}
                        </div>
                      ),
                    )}
                  </div>
                </aside>

                {/* Main preview */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        MY BOTS
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">
                        Your bots
                      </h3>
                    </div>

                    <div className="rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-medium text-white">
                      + Create bot
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <BotCard
                      name="JAMB Quiz Bot"
                      type="Education"
                      messages="2,431 messages"
                      status="Running"
                    />

                    <BotCard
                      name="Community Bot"
                      type="Community"
                      messages="842 messages"
                      status="Running"
                    />

                    <BotCard
                      name="Fun Bot"
                      type="Entertainment"
                      messages="316 messages"
                      status="Offline"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type BotCardProps = {
  name: string;
  type: string;
  messages: string;
  status: "Running" | "Offline";
};

function BotCard({ name, type, messages, status }: BotCardProps) {
  const running = status === "Running";

  return (
    <div className="rounded-xl border border-white/5 bg-white/2 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs">
            🤖
          </div>

          <div>
            <p className="text-xs font-medium text-white">{name}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{type}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              running ? "bg-emerald-400" : "bg-white/20"
            }`}
          />
          <span className="text-muted-foreground">{status}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[10px] text-muted-foreground">
        <span>{messages}</span>
        <span className="text-white/70">Open →</span>
      </div>
    </div>
  );
}
