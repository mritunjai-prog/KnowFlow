import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { Timeline } from './pages/Timeline';
import { Assistant } from './pages/Assistant';
import { Tasks } from './pages/Tasks';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Capture } from './pages/Capture';
import { DocumentDetail } from './pages/DocumentDetail';
import { Settings } from './pages/Settings';
import { SidebarLayout } from './components/layout/SidebarLayout';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-deep-slate font-body selection:bg-signal-red/20">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<SidebarLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/library" element={<Library />} />
            <Route path="/document/:id" element={<DocumentDetail />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
