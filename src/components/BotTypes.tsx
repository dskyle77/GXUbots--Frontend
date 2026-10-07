const botTypes = [
  {
    title: "Quiz Bots",
    description:
      "Build trivia, JAMB, school, and interactive question-based bots.",
    icon: "🧠",
  },
  {
    title: "Community Bots",
    description:
      "Add commands, moderation, games, utilities, and community features.",
    icon: "👥",
  },
  {
    title: "Business Bots",
    description:
      "Automate customer interactions, workflows, support, and more.",
    icon: "💼",
  },
  {
    title: "Fun & Games",
    description:
      "Create entertaining experiences, mini-games, challenges, and more.",
    icon: "🎮",
  },
];

export function BotTypes() {
  return (
    <section className="border-t border-white/5 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">
            ONE PLATFORM
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Build a bot for{" "}
            <span className="gxu-gradient-text">anything.</span>
          </h2>

          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            GXUbots gives you the building blocks. You decide what your bot
            becomes.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {botTypes.map((bot) => (
            <div
              key={bot.title}
              className="group rounded-2xl border border-white/5 bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:bg-white/2"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl">
                {bot.icon}
              </div>

              <h3 className="mt-5 text-base font-semibold text-white">
                {bot.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {bot.description}
              </p>

              <div className="mt-6 text-sm font-medium text-white/70 transition-colors group-hover:text-primary">
                Explore →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}