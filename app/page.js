'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

// Display helper: show the naira symbol nicely (stored as "N210bn" to keep SQL safe).
function pretty(text) {
  return (text || '').replace('N210bn', '\u20A6210bn');
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ trainings: 0, wigs: 0, evals: 0, responses: 0 });
  const [trainings, setTrainings] = useState([]);
  const [insight, setInsight] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      // Profile (name + role)
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, role, department')
        .eq('id', session.user.id)
        .maybeSingle();
      setProfile(prof);

      // Trainings, with their WIG name
      const { data: tr } = await supabase
        .from('trainings')
        .select('title, training_type, status, wigs(name)')
        .order('created_at', { ascending: true });
      setTrainings(tr || []);

      // Counts (head:true returns only the count, no rows)
      const [wigsRes, evalRes, respRes] = await Promise.all([
        supabase.from('wigs').select('*', { count: 'exact', head: true }),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }),
        supabase.from('evaluation_responses').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        trainings: (tr || []).length,
        wigs: wigsRes.count || 0,
        evals: evalRes.count || 0,
        responses: respRes.count || 0,
      });

      // Latest executive AI insight
      const { data: ins } = await supabase
        .from('ai_insights')
        .select('content')
        .eq('scope_type', 'executive')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setInsight(ins?.content || '');

      setLoading(false);
    }

    load();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return <div className="center-note">Loading your dashboard…</div>;
  }

  const roleLabel = (profile?.role || '').replace('_', ' ');
  const firstName = (profile?.full_name || 'there').split(' ')[0];

  return (
    <div>
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

      <div className="page">
        <div className="welcome">
          <h1>Welcome back, {firstName}</h1>
          <p>Here is the current state of learning impact across the organisation.</p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="value">{stats.trainings}</div>
            <div className="label">Trainings</div>
          </div>
          <div className="stat">
            <div className="value">{stats.wigs}</div>
            <div className="label">Strategic WIGs</div>
          </div>
          <div className="stat">
            <div className="value">{stats.evals}</div>
            <div className="label">Evaluations launched</div>
          </div>
          <div className="stat">
            <div className="value">{stats.responses}</div>
            <div className="label">Responses collected</div>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <h2>Trainings</h2>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>WIG</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((t, i) => (
                  <tr key={i}>
                    <td>{t.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.training_type}</td>
                    <td>{pretty(t.wigs?.name)}</td>
                    <td>
                      <span className={`pill ${t.status}`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>AI Insight</h2>
            <div className="insight">
              <span className="tag">Executive summary</span>
              <div>{pretty(insight) || 'No insights generated yet.'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
