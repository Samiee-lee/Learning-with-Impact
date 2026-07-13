'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function AppShell({ profile, nav, active, onSelect, title, subtitle, children }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); // mobile drawer

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const roleLabel = (profile?.role || '').replace('_', ' ');

  function pick(key) {
    onSelect(key);
    setOpen(false); // close drawer on mobile after choosing
  }

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo-chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/evolution-logo.png" alt="Evolution Academy" className="sidebar-logo" />
          </div>
          <div>
            <div className="sidebar-name">Learning With Impact</div>
            <div className="sidebar-sub">by Evolution Academy</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
            <button
              key={item.key}
              className={`side-link ${active === item.key ? 'active' : ''}`}
              onClick={() => pick(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{profile?.full_name || 'User'}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
          <button className="side-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="shell-overlay" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="shell-main">
        <div className="shell-topbar">
          <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <div className="shell-topbar-title">{title}</div>
        </div>

        <div className="shell-content">
          {(title || subtitle) && (
            <div className="welcome">
              {title ? <h1>{title}</h1> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
