'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function TopBar({ profile }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const roleLabel = (profile?.role || '').replace('_', ' ');

  return (
    <div className="topbar">
      <div className="brand-group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/evolution-logo.png" alt="Evolution Academy" className="brand-logo" />
        <div className="brand-divider" />
        <div>
          <div className="brand-name">Learning With Impact</div>
          <div className="brand-sub">by Evolution Academy</div>
        </div>
      </div>
      <div className="user-group">
        <div className="user-meta">
          <div className="user-name">{profile?.full_name || 'User'}</div>
          <div className="user-role">{roleLabel}</div>
        </div>
        <button className="btn-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
