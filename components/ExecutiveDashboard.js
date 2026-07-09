'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';
import AiInsightCard from './AiInsightCard';

export default function ExecutiveDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [wigRollup, setWigRollup] = useState([]); // [{ name, count }]
  const [avgReaction, setAvgReaction] = useState(null);
  const [impactScore, setImpactScore] = useState(null);
  const [responses, setResponses] = useState(0);
  const [insight, setInsight] = useState('');

  useEffect(() => {
    async function load() {
      // Trainings grouped by WIG (aggregate in JS)
      const { data: tr } = await supabase.from('trainings').select('title, wigs(name)');
      const counts = {};
      (tr || []).forEach((t) => {
        const name = t.wigs?.name || 'Unassigned';
        counts[name] = (counts[name] || 0) + 1;
      });
      const rollup = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      setWigRollup(rollup);

      // Average reaction/learning rating across the org
      const { data: ans } = await supabase
        .from('response_answers')
        .select('answer_numeric, evaluation_questions(question_type)');
      const ratings = (ans || [])
        .filter((a) => ['rating', 'confidence'].includes(a.evaluation_questions?.question_type) && a.answer_numeric != null)
        .map((a) => Number(a.answer_numeric));
      if (ratings.length) {
        setAvgReaction((ratings.reduce((s, n) => s + n, 0) / ratings.length).toFixed(1));
      }

      // Business impact score (Level 4)
      const { data: rm } = await supabase.from('results_metrics').select('ai_impact_score');
      const scores = (rm || []).map((r) => Number(r.ai_impact_score)).filter((n) => !isNaN(n));
      if (scores.length) {
        setImpactScore((scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(0));
      }

      const { count: respCount } = await supabase
        .from('evaluation_responses')
        .select('*', { count: 'exact', head: true });
      setResponses(respCount || 0);

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
  }, [profile.id]);

  if (loading) return <div className="center-note">Loading…</div>;

  const maxCount = Math.max(1, ...wigRollup.map((w) => w.count));

  return (
    <div className="page">
      <div className="welcome">
        <h1>Executive impact view</h1>
        <p>How learning investment is tracking against strategic goals.</p>
      </div>

      <div className="stats">
        <div className="stat"><div className="value">{avgReaction ?? '—'}<span className="unit">/5</span></div><div className="label">Avg learning rating</div></div>
        <div className="stat"><div className="value">{impactScore ?? '—'}</div><div className="label">Business impact score</div></div>
        <div className="stat"><div className="value">{responses}</div><div className="label">Responses collected</div></div>
        <div className="stat"><div className="value">{wigRollup.length}</div><div className="label">WIGs in play</div></div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Trainings by strategic goal (WIG)</h2>
          <div className="bars">
            {wigRollup.map((w, i) => (
              <div className="bar-row" key={i}>
                <div className="bar-label">{pretty(w.name)}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(w.count / maxCount) * 100}%` }} />
                </div>
                <div className="bar-value">{w.count}</div>
              </div>
            ))}
          </div>
        </div>

        <AiInsightCard
          initialInsight={insight}
          profileId={profile.id}
          summary={
            `Average learning rating: ${avgReaction ?? 'n/a'}/5. ` +
            `Business impact score: ${impactScore ?? 'n/a'}. ` +
            `Responses collected: ${responses}. ` +
            `Trainings per WIG: ${wigRollup.map((w) => `${w.name}: ${w.count}`).join('; ')}.`
          }
        />
      </div>
    </div>
  );
}
