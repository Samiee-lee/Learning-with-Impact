'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const I = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  trainings: (<svg viewBox="0 0 24 24" {...I}><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>),
  evaluations: (<svg viewBox="0 0 24 24" {...I}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>),
  wigs: (<svg viewBox="0 0 24 24" {...I}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>),
  reports: (<svg viewBox="0 0 24 24" {...I}><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" /><rect x="12" y="7" width="3" height="11" /><rect x="17" y="4" width="3" height="14" /></svg>),
  feedback: (<svg viewBox="0 0 24 24" {...I}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>),
  results: (<svg viewBox="0 0 24 24" {...I}><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>),
  learning: (<svg viewBox="0 0 24 24" {...I}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg>),
  team: (<svg viewBox="0 0 24 24" {...I}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>),
  impact: (<svg viewBox="0 0 24 24" {...I}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>),
};

export default function AppShell({ profile, nav, active, onSelect, title, subtitle, children }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const roleLabel = (profile?.role || '').replace('_', ' ');

  function pick(key) {
    if (onSelect) onSelect(key);
    setOpen(false);
  }

  return (
    <div className="shell">
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
              {item.icon && ICONS[item.icon] ? ICONS[item.icon] : null}
              <span>{item.label}</span>
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

      {open && <div className="shell-overlay" onClick={() => setOpen(false)} />}

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
