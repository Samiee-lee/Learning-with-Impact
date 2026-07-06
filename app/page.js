'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import TopBar from '../components/TopBar';
import AdminDashboard from '../components/AdminDashboard';
import EmployeeDashboard from '../components/EmployeeDashboard';
import ManagerDashboard from '../components/ManagerDashboard';
import ExecutiveDashboard from '../components/ExecutiveDashboard';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, role, department')
        .eq('id', session.user.id)
        .maybeSingle();

      setProfile(prof);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return <div className="center-note">Loading your dashboard…</div>;
  }

  function renderDashboard() {
    switch (profile?.role) {
      case 'administrator':
        return <AdminDashboard profile={profile} />;
      case 'employee':
        return <EmployeeDashboard profile={profile} />;
      case 'line_manager':
        return <ManagerDashboard profile={profile} />;
      case 'executive':
        return <ExecutiveDashboard profile={profile} />;
      default:
        return <div className="center-note">No dashboard configured for this role yet.</div>;
    }
  }

  return (
    <div>
      <TopBar profile={profile} />
      {renderDashboard()}
    </div>
  );
}
