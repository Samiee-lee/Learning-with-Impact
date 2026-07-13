'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import AiInsightCard from './AiInsightCard';
import TrainingsManager from './TrainingsManager';
import WigManager from './WigManager';
import EvaluationManager from './EvaluationManager';
import ReportsManager from './ReportsManager';
import FeedbackViewer from './FeedbackViewer';
import ResultsManager from './ResultsManager';
import AppShell from './AppShell';

const NAV = [
  { key: 'trainings', label: 'Trainings', icon: 'trainings' },
  { key: 'evaluations', label: 'Evaluations', icon: 'evaluations' },
  { key: 'wigs', label: 'Strategic goals', icon: 'wigs' },
  { key: 'reports', label: 'Reports', icon: 'reports' },
  { key: 'feedback', label: 'Feedback', icon: 'feedback' },
  { key: 'results', label: 'Results (L4)', icon: 'results' },
];

export default function AdminDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('trainings');
  const [refreshKey, setRefreshKey] = useState(0);

  const [stats, setStats] = useState({ trainings: 0, wigs: 0, evals: 0, responses: 0 });
  const [aiSummary, setAiSummary] = useState('');
  const [insight, setInsight] = useState('');

  const loadOverview = useCallback(async () => {
    const { data: tr } = await supabase.from('trainings').select('title, status, wigs(name)');

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

  function handleChanged() {
    loadOverview();
    setRefreshKey((k) => k + 1);
  }

  if (loading) return <div className="center-note">Loading…</div>;

  return (
    <AppShell
      profile={profile}
      nav={NAV}
      active={tab}
      onSelect={setTab}
      title="Admin console"
      subtitle="Manage trainings, strategic goals and reporting for the organisation."
    >
      <div className="stats">
        <div className="stat"><div className="value">{stats.trainings}</div><div className="label">Trainings</div></div>
        <div className="stat"><div className="value">{stats.wigs}</div><div className="label">Strategic WIGs</div></div>
        <div className="stat"><div className="value">{stats.evals}</div><div className="label">Evaluations launched</div></div>
        <div className="stat"><div className="value">{stats.responses}</div><div className="label">Responses collected</div></div>
      </div>

      <div style={{ marginBottom: 20 }}>
        {tab === 'trainings' && (
          <TrainingsManager profile={profile} onChanged={handleChanged} refreshKey={refreshKey} />
        )}
        {tab === 'evaluations' && (
          <EvaluationManager profile={profile} onChanged={handleChanged} refreshKey={refreshKey} />
        )}
        {tab === 'wigs' && <WigManager profile={profile} onChanged={handleChanged} />}
        {tab === 'reports' && <ReportsManager />}
        {tab === 'feedback' && <FeedbackViewer />}
        {tab === 'results' && <ResultsManager />}
      </div>

      <AiInsightCard initialInsight={insight} profileId={profile.id} summary={aiSummary} />
    </AppShell>
  );
}
