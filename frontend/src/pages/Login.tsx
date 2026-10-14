import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { useAction } from '../api/hooks';
import { request, json } from '../api/client';
import type { Session } from '../api/types';
import { Button } from '../components/ui/Button';
import { ErrorNotice, Field, fieldClass, Loading } from '../components/ui/Feedback';
import { ShaderBackground } from '../components/ui/ShaderBackground';
export function Login() {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth();
  const action = useAction();
  const navigate = useNavigate();
  const location = useLocation();
  const from: unknown = location.state?.from;
  const destination =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.startsWith('/login')
      ? from
      : '/dashboard';
  if (auth.user) return <Navigate to={destination} replace />;
  return (
    <main className="relative flex min-h-dvh items-center justify-center p-4">
      <ShaderBackground />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-primary/15 bg-sand/95 p-6 shadow-xl sm:p-10">
        <Link to="/" className="font-heading text-xl font-bold">
          KnowFlow
        </Link>
        <h1 className="mt-8 font-heading text-3xl font-bold">
          {register ? 'Create your account' : 'Welcome back'}
        </h1>
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
                navigate(register ? '/onboarding' : destination, { replace: true });
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
            className="w-full"
            disabled={auth.loading || !!auth.error || action.pending}
          >
            {action.pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <Button
          variant="ghost"
          className="mt-4 w-full"
          disabled={action.pending}
          onClick={() => {
            setRegister((v) => !v);
            setPassword('');
            action.clear();
          }}
        >
          {register ? 'Already have an account? Sign in' : 'New to KnowFlow? Create an account'}
        </Button>
        <p className="mt-6 text-sm text-primary/80">
          Accounts require the KnowFlow backend. No demonstration login is enabled.
        </p>
      </section>
    </main>
  );
}
