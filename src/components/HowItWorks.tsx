const steps = [
  {
    number: "01",
    title: "Create",
    description:
      "Start with a blank bot or choose a template that fits your idea.",
  },
  {
    number: "02",
    title: "Configure",
    description:
      "Add commands, features, assets, and the behavior you want your bot to have.",
  },
  {
    number: "03",
    title: "Connect",
    description:
      "Connect your WhatsApp account and get your bot ready to receive messages.",
  },
  {
    number: "04",
    title: "Run",
    description:
      "Launch your bot and let GXUbots handle the runtime while you focus on building.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative border-t border-white/5 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">HOW IT WORKS</p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            From idea to <span className="gxu-gradient-text">live bot.</span>
          </h2>

          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Create your bot, give it the features it needs, connect WhatsApp,
            and put it to work.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
          {/* Connecting line */}
          <div className="absolute left-[12%] right-[12%] top-7 hidden h-px bg-white/10 md:block" />

          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              {/* Number */}
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-[#0f1117] text-sm font-semibold text-primary shadow-[0_0_30px_rgba(139,92,246,0.08)]">
                {step.number}
              </div>

              <h3 className="mt-6 text-base font-semibold text-white">
                {step.title}
              </h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
