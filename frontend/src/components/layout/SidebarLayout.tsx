import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Clock, MessageSquare, CheckSquare, Settings, ScanLine, Plus, FileText, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../ui/Button';
import { ShaderBackground } from '../ui/ShaderBackground';
import { LineSidebar } from '../ui/LineSidebar';

export function SidebarLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Plus, label: 'Capture', to: '/capture' },
    { icon: FileText, label: 'Library', to: '/library' },
    { icon: Clock, label: 'Timeline', to: '/timeline' },
    { icon: CheckSquare, label: 'Tasks', to: '/tasks' },
    { icon: MessageSquare, label: 'Assistant', to: '/assistant' },
  ];

  const navigate = useNavigate();
  const location = useLocation();
  const activeIndex = navItems.findIndex(item => item.to === location.pathname);

  return (
    // Outer shell: NO background — lets the fixed shader canvas show through
    <div className="flex h-screen overflow-hidden font-body">
      {/* ── Shader canvas: fixed, painted first at z=0 ── */}
      <ShaderBackground />

      {/* ── Sidebar: always mounted, only width animates ── */}
      <motion.aside
        animate={{ width: sidebarOpen ? 256 : 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="flex-shrink-0 overflow-hidden flex flex-col border-r"
        style={{
          position: 'relative',
          zIndex: 20,
          background: 'rgba(8, 50, 62, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(144, 174, 173, 0.15)',
          boxShadow: '4px 0 32px rgba(8,50,62,0.2)',
        }}
      >
        {/* Fixed-width inner wrapper so content doesn't squash during animation */}
        <div className="w-64 flex flex-col h-full">
          {/* Logo row */}
          <div className="h-16 flex items-center px-6 gap-3 border-b border-sand/10 shrink-0">
            <ScanLine className="h-5 w-5 text-signal-red shrink-0" />
            <span className="font-heading text-lg font-bold tracking-tight text-sand whitespace-nowrap">
              KnowFlow
            </span>
          </div>

          {/* Nav items */}
          <div className="flex-1 px-4 py-6 overflow-hidden">
            <LineSidebar
              items={navItems}
              defaultActive={activeIndex !== -1 ? activeIndex : null}
              onItemClick={(idx) => navigate(navItems[idx].to)}
              itemGap={24}
              fontSize={0.9}
              markerLength={30}
            />
          </div>

          {/* Settings */}
          <div className="p-4 border-t border-sand/10 shrink-0">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                  isActive ? 'bg-white/10 text-white' : 'text-sand/70 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Settings className="h-4 w-4" />
              <span className="whitespace-nowrap">Settings</span>
            </NavLink>
          </div>
        </div>
      </motion.aside>

      {/* ── Main content column ── */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ position: 'relative', zIndex: 20 }}
      >
        {/* Topbar with toggle */}
        <div
          className="h-14 flex items-center px-4 gap-3 shrink-0 border-b"
          style={{
            background: 'rgba(251, 233, 208, 0.35)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'rgba(144, 174, 173, 0.25)',
          }}
        >
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg transition-all hover:bg-primary/10 active:scale-95 text-primary"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <motion.div
              animate={{ rotate: sidebarOpen ? 0 : 180 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </motion.div>
          </button>

          {/* Show brand when sidebar is hidden */}
          <motion.div
            animate={{ opacity: sidebarOpen ? 0 : 1, x: sidebarOpen ? -8 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 pointer-events-none"
          >
            <ScanLine className="h-5 w-5 text-signal-red" />
            <span className="font-heading font-bold text-primary">KnowFlow</span>
          </motion.div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
