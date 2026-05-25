import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo, LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link to="/signup">Join Agora</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
          <p className="mb-6 text-xs uppercase tracking-[0.28em] text-muted-foreground">
            The modern gathering place
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] sm:text-7xl">
            Find the room
            <br />
            you've been missing.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground">
            We work too much. We scroll too much. We meet too little. Agora finds
            you small, real-world gatherings tonight — picked from your taste in
            music, sport, film, and the things you actually care about.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Find your event</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/signup">I host events</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free for members. Always.
          </p>
        </section>

        {/* Three pillars */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:grid-cols-3">
            {[
              {
                t: "Tell us your night",
                d: "“Quiet bar with people who like Phoebe Bridgers.” “Sunday long run, 10k pace.” Type it. We'll match it.",
              },
              {
                t: "Real places. Real people.",
                d: "Coffee roasters, climbing gyms, film clubs, run crews. Local hosts, not algorithms.",
              },
              {
                t: "Show up. That's it.",
                d: "No swipes. No DMs. RSVP and walk in. The room does the rest.",
              },
            ].map((p) => (
              <div key={p.t}>
                <LogoMark className="mb-4 h-7 w-7 text-primary" />
                <h3 className="font-display text-2xl">{p.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For hosts */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 sm:grid-cols-2 sm:items-center">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                For event makers
              </p>
              <h2 className="font-display text-4xl sm:text-5xl">
                Your room. Filled with the right people.
              </h2>
              <p className="mt-5 text-muted-foreground">
                Coffees, gyms, trainers, restaurants, clubs — list a gathering and
                Agora puts it in front of locals who already want exactly what
                you're offering. See what your neighborhood is asking for tonight.
                Turn one-time attendees into a community you own.
              </p>
              <div className="mt-7">
                <Button asChild>
                  <Link to="/signup">Open a host account</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Tonight near you, people are asking for
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["acoustic", "vinyl listening", "5k run", "boardgames", "indie film", "single malt", "techno", "climbing", "pottery", "espresso"].map(
                  (t) => (
                    <span
                      key={t}
                      className="rounded-full border bg-background px-3 py-1 text-sm"
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Built-in CRM. Lead lists. Demand signals. One app.
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="font-display text-4xl sm:text-5xl">
              The gathering place, returned.
            </h2>
            <p className="mt-5 text-muted-foreground">
              Less scrolling. More showing up. Your next favorite night is
              probably ten minutes away.
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link to="/signup">Find your event</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-10 text-sm text-muted-foreground">
        <Logo showWordmark className="opacity-70" />
        <p>© {new Date().getFullYear()} Agora</p>
      </footer>
    </div>
  );
}
