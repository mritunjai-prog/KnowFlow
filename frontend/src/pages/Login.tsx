import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { Network, LayoutGrid, Share2, Sparkles, ArrowLeft } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { useAction } from '../api/hooks';
import { request, json } from '../api/client';
import type { Session } from '../api/types';
import { Button } from '../components/ui/Button';
import { ErrorNotice, Field, fieldClass, Loading } from '../components/ui/Feedback';
import { ShaderBackground } from '../components/3d/ShaderBackground';
import { PixelCard } from '../components/ui/PixelCard';
const NetworkGraph = lazy(() =>
  import('../components/3d/NetworkGraph').then((module) => ({ default: module.NetworkGraph })),
);

function LoginCard({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: (element: HTMLElement | null) => void;
}) {
  const present = useIsPresent();
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reduced && present) onReady(ref.current);
  }, [reduced, present, onReady]);
  return (
    <motion.section
      ref={ref}
      aria-labelledby="login-heading"
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : { rotateY: -90, opacity: 0, transition: { duration: 0.18 } }
      }
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 110, damping: 20 }}
      onAnimationComplete={() => {
        if (present) onReady(ref.current);
      }}
      style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
      className="w-full max-w-md"
    >
      <PixelCard className="w-full p-7 sm:p-10 lg:p-12">
        <Network
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 text-primary/5"
        />
        <div className="relative flex min-h-[34rem] flex-col justify-center">{children}</div>
      </PixelCard>
    </motion.section>
  );
}
export function Login() {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const reduced = usePrefersReducedMotion();
  const switched = useRef(false);
  const auth = useAuth();
  const action = useAction();
  const location = useLocation();
  const from: unknown = location.state?.from;
  const destination =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.startsWith('/login')
      ? from
      : '/dashboard';
  const switchMode = () => {
    switched.current = true;
    setRegister((value) => !value);
    setPassword('');
    action.clear();
  };
  const focusHeading = (element: HTMLElement | null) => {
    if (switched.current && element) {
      element.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
      switched.current = false;
    }
  };
  if (auth.user) return <Navigate to={register ? '/onboarding' : destination} replace />;
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-x-clip p-4 md:p-8">
      <ShaderBackground />
      {!reduced && (
        <Suspense fallback={null}>
          <NetworkGraph />
        </Suspense>
      )}
      <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <section
          aria-label="What you can do with KnowFlow"
          className="hidden flex-col gap-6 lg:flex"
        >
          {[
            {
              icon: LayoutGrid,
              title: 'Bring your knowledge together',
              description: 'Capture notes, documents and meeting images.',
              label: 'Capture and organize',
            },
            {
              icon: Share2,
              title: 'Follow the connections',
              description: 'Keep tasks and answers linked to their sources.',
              label: 'Connected knowledge',
            },
            {
              icon: Sparkles,
              title: 'Ask with evidence',
              description: 'Find answers in the material you can access.',
              label: 'Source-backed answers',
            },
          ].map((item, index) => (
            <motion.article
              key={item.title}
              initial={reduced ? false : { opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : { delay: 0.2 + index * 0.2, type: 'spring' }}
              whileHover={reduced ? undefined : { y: -4 }}
              className={`flex items-center gap-4 rounded-xl border border-sage/50 bg-sand/75 p-6 shadow-[0_8px_32px_rgba(8,50,62,0.1)] backdrop-blur-md ${index === 1 ? 'ml-8' : 'mr-8'}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <item.icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-mono text-sm font-bold text-primary">{item.title}</h2>
                <p className="mt-2 text-sm text-primary">{item.description}</p>
                <p className="mt-2 text-xs text-primary/80">{item.label}</p>
              </div>
            </motion.article>
          ))}
        </section>
        <motion.div
          initial={reduced ? false : { opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 20 }}
          className="flex min-w-0 justify-center lg:justify-end"
          style={{ perspective: 1000 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <LoginCard key={register ? 'register' : 'login'} onReady={focusHeading}>
              <Link
                to="/"
                className="flex w-fit items-center gap-3 font-heading text-2xl font-bold"
              >
                <Network aria-hidden="true" className="h-8 w-8" />
                KnowFlow
              </Link>
              <h1
                id="login-heading"
                tabIndex={-1}
                className="mt-8 font-heading text-3xl font-bold tracking-tight sm:text-4xl"
              >
                {register ? 'Create your account' : 'Welcome back'}
              </h1>
              {register && (
                <Button
                  variant="ghost"
                  className="mt-3 w-fit"
                  disabled={action.pending}
                  onClick={switchMode}
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Back to sign in
                </Button>
              )}
              <p className="mb-6 mt-2 text-primary/80">
                Your notes, documents and next steps, in one place.
              </p>
              {auth.loading && <Loading label="Preparing a secure session…" />}
              <ErrorNotice error={auth.error} retry={auth.reload} />
              <ErrorNotice error={action.error} />
              <form
                key={String(register)}
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!email.trim() || !password.trim() || (register && !name.trim())) return;
                  void action.run(
                    (signal) =>
                      request<Session>(register ? '/auth/register' : '/auth/login', {
                        ...json('POST', {
                          email: email.trim(),
                          password,
                          ...(register ? { name: name.trim() } : {}),
                        }),
                        signal,
                      }),
                    (session) => {
                      auth.accept(session);
                      setPassword('');
                    },
                  );
                }}
              >
                {register && (
                  <Field id="name" label="Full name">
                    <input
                      id="name"
                      className={fieldClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={100}
                      autoComplete="name"
                    />
                  </Field>
                )}
                <Field id="email" label="Email address">
                  <input
                    id="email"
                    className={fieldClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                  />
                </Field>
                <Field
                  id="password"
                  label="Password"
                  hint={
                    register
                      ? 'Use at least 12 characters. The server enforces the account password policy.'
                      : undefined
                  }
                >
                  <input
                    id="password"
                    className={fieldClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={register ? 12 : 1}
                    maxLength={128}
                    type="password"
                    autoComplete={register ? 'new-password' : 'current-password'}
                    aria-describedby={register ? 'password-hint' : undefined}
                  />
                </Field>
                <Button
                  type="submit"
                  magnet={!reduced}
                  whileTap={reduced ? undefined : { scale: 0.98 }}
                  className="w-full py-4 font-mono shadow-lg"
                  disabled={auth.loading || !!auth.error || action.pending}
                >
                  {action.pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
                </Button>
              </form>
              <Button
                variant="ghost"
                className="mt-4 w-full"
                disabled={action.pending}
                onClick={switchMode}
              >
                {register
                  ? 'Already have an account? Sign in'
                  : 'New to KnowFlow? Create an account'}
              </Button>
              <p className="mt-6 text-sm text-primary/80">
                Accounts require the KnowFlow backend. No demonstration login is enabled.
              </p>
            </LoginCard>
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
