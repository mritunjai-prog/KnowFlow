import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, Search, CheckSquare, ArrowRight, ScanLine } from 'lucide-react';
const LandingHeroGraph = lazy(() =>
  import('../components/3d/LandingHeroGraph').then((module) => ({
    default: module.LandingHeroGraph,
  })),
);
export function Landing() {
  const reduced = useReducedMotion();
  return (
    <div className="text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-primary/15 bg-sand/90 px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-heading text-xl font-bold">
          <ScanLine aria-hidden="true" />
          KnowFlow
        </Link>
        <nav aria-label="Welcome navigation" className="flex items-center gap-6">
          <a href="#how-it-works" className="underline">
            How it works
          </a>
          <Link
            to="/login"
            className="rounded-full bg-secondary px-5 py-3 font-semibold text-white"
          >
            Sign in
          </Link>
        </nav>
      </header>
      <main id="main-content">
        <section className="relative isolate overflow-hidden px-6 py-24 sm:py-36">
          {!reduced && (
            <Suspense fallback={null}>
              <LandingHeroGraph />
            </Suspense>
          )}
          <div className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-primary/10 bg-sand/95 p-6 text-center shadow-sm backdrop-blur-xl sm:p-12">
            <p className="font-mono text-sm uppercase tracking-widest text-secondary">
              Your personal knowledge hub
            </p>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-5 font-heading text-4xl font-bold tracking-tight sm:text-6xl"
            >
              Capture a thought.
              <br />
              Find it when it matters.
            </motion.h1>
            <p className="mx-auto mt-6 max-w-xl text-lg">
              Bring notes, documents and meeting images together. Organize topics, track action
              items and ask questions with links back to your sources.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-6 py-3 font-semibold text-white"
            >
              Open KnowFlow <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-heading text-3xl font-bold">
            From scattered notes to useful knowledge
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Camera,
                title: 'Capture and organize',
                text: 'Capture images, upload documents or record audio. Review processed text and correct topics.',
              },
              {
                icon: Search,
                title: 'Ask with evidence',
                text: 'Ask about your library and follow source references. AI processing depends on the configured backend models.',
              },
              {
                icon: CheckSquare,
                title: 'Follow through',
                text: 'Review extracted tasks, set due dates and track completion. Share selected documents with controlled permissions.',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-primary/15 bg-white/50 p-6"
              >
                <item.icon aria-hidden="true" className="mb-5 h-8 w-8 text-secondary" />
                <h3 className="font-heading text-xl font-bold">{item.title}</h3>
                <p className="mt-3 leading-relaxed">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-primary/15 p-6 text-center text-sm">
        KnowFlow · Personal notes, shared thoughtfully.
      </footer>
    </div>
  );
}
