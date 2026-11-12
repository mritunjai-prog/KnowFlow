import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { Login } from './Login';

vi.mock('../components/3d/ShaderBackground', () => ({ ShaderBackground: () => null }));
vi.mock('../components/3d/NetworkGraph', () => ({ NetworkGraph: () => null }));
vi.mock('../components/ui/PixelCard', () => ({
  PixelCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

it('opens the saved verification form from sign-in without a second form', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: null, csrfToken: 'csrf' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Have a verification token? Confirm email' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await userEvent.click(confirm);
  expect(await screen.findByRole('heading', { name: 'Confirm your email' })).toBeInTheDocument();
  expect(document.querySelectorAll('form')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /^Sign in$/ })).not.toBeInTheDocument();
});
