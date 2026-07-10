'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import AiInsightCard from './AiInsightCard';
import TrainingsManager from './TrainingsManager';
import WigManager from './WigManager';
import EvaluationManager from './EvaluationManager';

export default function AdminDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('trainings');
  const [refreshKey, setRefreshKey] = useState(0);

  const [stats, setStats] = useState({ trainings: 0, wigs: 0, evals: 0, responses: 0 });
  const [aiSummary, setAiSummary] = useState('');
  const [insight, setInsight] = useState('');

  const loadOverview = useCallback(async () => {
    const { data: tr } = await supabase
      .from('trainings')
      .select('title, status, wigs(name)');

    const [wigRes, evalRes, respRes] = await Promise.all([
      supabase.from('wigs').select('*', { count: 'exact', head: true }),
      supabase.from('evaluations').select('*', { count: 'exact', head: true }),
      supabase.from('evaluation_responses').select('*', { count: 'exact', head: true }),
    ]);

    const next = {
      trainings: (tr || []).length,
      wigs: wigRes.count || 0,
      evals: evalRes.count || 0,
      responses: respRes.count || 0,
    };
    setStats(next);

    setAiSummary(
      `Trainings: ${next.trainings}; Strategic WIGs: ${next.wigs}; ` +
        `Evaluations launched: ${next.evals}; Responses collected: ${next.responses}. ` +
        `Programmes: ${(tr || [])
          .map((t) => `${t.title} [${t.status}, WIG: ${t.wigs?.name || 'none'}]`)
          .join('; ')}.`
    );

    const { data: ins } = await supabase
      .from('ai_insights')
      .select('content')
      .eq('scope_type', 'executive')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setInsight(ins?.content || '');

    setLoading(false);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Called by child managers after any create/edit/delete
  function handleChanged() {
    loadOverview();
    setRefreshKey((k) => k + 1);
  }

  if (loading) return <div className="center-note">Loading…</div>;

  return (
    <div className="page">
      <div className="welcome">
        <h1>Admin console</h1>
        <p>Manage trainings, strategic goals and reporting for the organisation.</p>
      </div>

      <div className="stats">
        <div className="stat"><div className="value">{stats.trainings}</div><div className="label">Trainings</div></div>
        <div className="stat"><div className="value">{stats.wigs}</div><div className="label">Strategic WIGs</div></div>
        <div className="stat"><div className="value">{stats.evals}</div><div className="label">Evaluations launched</div></div>
        <div className="stat"><div className="value">{stats.responses}</div><div className="label">Responses collected</div></div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'trainings' ? 'active' : ''}`}
          onClick={() => setTab('trainings')}
        >
          Trainings
        </button>
        <button
          className={`tab ${tab === 'evaluations' ? 'active' : ''}`}
          onClick={() => setTab('evaluations')}
        >
          Evaluations
        </button>
        <button
          className={`tab ${tab === 'wigs' ? 'active' : ''}`}
          onClick={() => setTab('wigs')}
        >
          Strategic goals
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        {tab === 'trainings' && (
          <TrainingsManager profile={profile} onChanged={handleChanged} refreshKey={refreshKey} />
        )}
        {tab === 'evaluations' && (
          <EvaluationManager profile={profile} onChanged={handleChanged} refreshKey={refreshKey} />
        )}
        {tab === 'wigs' && <WigManager profile={profile} onChanged={handleChanged} />}
      </div>

      <AiInsightCard initialInsight={insight} profileId={profile.id} summary={aiSummary} />
    </div>
  );
}
