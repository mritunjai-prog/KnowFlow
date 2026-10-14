import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, RequireAuth } from './auth/AuthContext';
import { SidebarLayout } from './components/layout/SidebarLayout';
import { ErrorBoundary, Loading, NotFound } from './components/ui/Feedback';
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Capture = lazy(() => import('./pages/Capture').then((m) => ({ default: m.Capture })));
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const DocumentDetail = lazy(() =>
  import('./pages/DocumentDetail').then((m) => ({ default: m.DocumentDetail })),
);
const Timeline = lazy(() => import('./pages/Timeline').then((m) => ({ default: m.Timeline })));
const Assistant = lazy(() => import('./pages/Assistant').then((m) => ({ default: m.Assistant })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Onboarding = lazy(() =>
  import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })),
);
const Meetings = lazy(() => import('./pages/Meetings').then((m) => ({ default: m.Meetings })));
const MeetingDetail = lazy(() =>
  import('./pages/Meetings').then((m) => ({ default: m.MeetingDetail })),
);
const Processing = lazy(() =>
  import('./pages/Processing').then((m) => ({ default: m.Processing })),
);
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const Sharing = lazy(() => import('./pages/Sharing').then((m) => ({ default: m.Sharing })));
export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading label="Opening page…" />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route element={<RequireAuth />}>
                  <Route element={<SidebarLayout />}>
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/capture" element={<Capture />} />
                    <Route path="/processing/:id" element={<Processing />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/document/:id" element={<DocumentDetail />} />
                    <Route path="/meetings" element={<Meetings />} />
                    <Route path="/meetings/:id" element={<MeetingDetail />} />
                    <Route path="/timeline" element={<Timeline />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/sharing" element={<Sharing />} />
                    <Route element={<RequireAuth admin />}>
                      <Route path="/admin" element={<Admin />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}
