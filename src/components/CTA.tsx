export function CTA() {
  return (
    <section className="relative overflow-hidden border-t border-white/5 py-24 sm:py-32">
      {/* Glow */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-125 w-175 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="gxu-card relative overflow-hidden px-6 py-16 sm:px-12 sm:py-20">
          <div className="absolute inset-0 bg-linear-to-br from-primary/8 via-transparent to-blue-500/5" />

          <div className="relative">
            <p className="text-sm font-medium text-primary">START BUILDING</p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Your next bot starts here.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Build something useful, fun, weird, or completely your own.
              GXUbots gives you the tools to make it happen.
            </p>

            <a
              href="/signup"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:shadow-gxu-sm"
            >
              Create your first bot
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
