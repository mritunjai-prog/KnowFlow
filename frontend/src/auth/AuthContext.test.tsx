import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthProvider, RequireAuth } from './AuthContext';
function app() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<h1>Login screen</h1>} />
          <Route element={<RequireAuth admin />}>
            <Route path="/admin" element={<h1>Admin data</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}
function session(role: string | null) {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            user: role
              ? {
                  id: 'user',
                  name: 'Tester',
                  email: 'test@example.org',
                  role,
                  onboardingComplete: false,
                }
              : null,
            csrfToken: 'test',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
  );
}
it('redirects anonymous users without disclosing protected content', async () => {
  session(null);
  app();
  expect(await screen.findByText('Login screen')).toBeInTheDocument();
  expect(screen.queryByText('Admin data')).not.toBeInTheDocument();
});
it('denies a non-admin user', async () => {
  session('user');
  app();
  expect(await screen.findByText('Access denied')).toBeInTheDocument();
  expect(screen.queryByText('Admin data')).not.toBeInTheDocument();
});
it('allows a server-provided admin role', async () => {
  session('admin');
  app();
  expect(await screen.findByText('Admin data')).toBeInTheDocument();
});
it('does not create a user when the service is offline', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
  app();
  expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Admin data')).not.toBeInTheDocument();
});
