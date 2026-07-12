'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';
import { attainment } from './KpiManager';

function statusOf(a) {
  if (a === null) return { label: 'incomplete', cls: '' };
  if (a >= 1) return { label: 'target met', cls: 'good' };
  if (a >= 0.6) return { label: 'on track', cls: 'mid' };
  if (a >= 0) return { label: 'behind', cls: 'low' };
  return { label: 'regressed', cls: 'low' };
}

export default function ResultsManager() {
  const [loading, setLoading] = useState(true);
  const [wigs, setWigs] = useState([]);
  const [ai, setAi] = useState({}); // wigId -> { text, loading, error }

  useEffect(() => {
    async function load() {
      const [{ data: w }, { data: k }, { data: tr }] = await Promise.all([
        supabase.from('wigs').select('id, name').order('name'),
        supabase.from('wig_kpis').select('id, wig_id, name, unit, direction, baseline, target, current').order('created_at'),
        supabase.from('trainings').select('id, title, wig_id'),
      ]);

      const kByWig = {};
      (k || []).forEach((row) => {
        if (!kByWig[row.wig_id]) kByWig[row.wig_id] = [];
        kByWig[row.wig_id].push(row);
      });
      const tByWig = {};
      (tr || []).forEach((row) => {
        if (!row.wig_id) return;
        if (!tByWig[row.wig_id]) tByWig[row.wig_id] = [];
        tByWig[row.wig_id].push(row);
      });

      setWigs((w || []).map((x) => ({ ...x, kpis: kByWig[x.id] || [], trainings: tByWig[x.id] || [] })));
      setLoading(false);
    }
    load();
  }, []);

  async function interpret(wig) {
    setAi((s) => ({ ...s, [wig.id]: { loading: true, error: '', text: '' } }));

    const kpiLines = wig.kpis.map((k) => {
      const a = attainment(k);
      const pct = a === null ? 'n/a' : `${Math.round(a * 100)}% of the way`;
      return `${k.name}: baseline ${k.baseline ?? '?'}${k.unit}, current ${k.current ?? '?'}${k.unit}, target ${k.target ?? '?'}${k.unit} (${k.direction} is better, ${pct})`;
    });

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'results_interpretation',
          data: {
            wig: wig.name,
            kpis: kpiLines,
            trainings: wig.trainings.map((t) => t.title),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) setAi((s) => ({ ...s, [wig.id]: { loading: false, error: json.error || 'Could not interpret.', text: '' } }));
      else setAi((s) => ({ ...s, [wig.id]: { loading: false, error: '', text: json.text } }));
    } catch (e) {
      setAi((s) => ({ ...s, [wig.id]: { loading: false, error: 'Could not reach the AI service.', text: '' } }));
    }
  }

  if (loading) return <div className="center-note">Loading results…</div>;

  return (
    <div>
      <div className="field-hint" style={{ marginBottom: 16 }}>
        Level 4 measures real business results: how each strategic goal’s KPIs have moved, and what
        that means. The AI reads the movement but never claims the training caused it — it flags
        what else might have.
      </div>

      {wigs.length === 0 && <div className="card"><div className="empty">No strategic goals yet.</div></div>}

      {wigs.map((wig) => {
        const state = ai[wig.id] || {};
        return (
          <div className="card" style={{ marginBottom: 20 }} key={wig.id}>
            <div className="card-head">
              <h2>{pretty(wig.name)}</h2>
              <button
                className="btn-small primary-small"
                onClick={() => interpret(wig)}
                disabled={state.loading || wig.kpis.length === 0}
              >
                {state.loading ? 'Interpreting…' : '✨ Interpret impact with AI'}
              </button>
            </div>

            {wig.kpis.length === 0 ? (
              <div className="empty">
                No KPIs for this goal yet. Add them under Strategic goals → Manage.
              </div>
            ) : (
              wig.kpis.map((k) => {
                const a = attainment(k);
                const st = statusOf(a);
                const pct = a === null ? 0 : Math.max(0, Math.min(100, a * 100));
                return (
                  <div key={k.id} className="kpi-row">
                    <div className="kpi-top">
                      <div className="kpi-name">
                        {k.name}
                        <span className="kpi-dir">{k.direction === 'increase' ? '↑ better' : '↓ better'}</span>
                      </div>
                      <span className={`score ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="kpi-figures">
                      <span>Baseline <strong>{k.baseline ?? '—'}{k.unit}</strong></span>
                      <span>Current <strong>{k.current ?? '—'}{k.unit}</strong></span>
                      <span>Target <strong>{k.target ?? '—'}{k.unit}</strong></span>
                      {a !== null && <span className="kpi-att">{Math.round(a * 100)}% of the way</span>}
                    </div>
                    <div className="bar-track" style={{ marginTop: 6 }}>
                      <div className={`bar-fill ${st.cls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}

            {wig.trainings.length > 0 && (
              <div className="field-hint" style={{ marginTop: 10 }}>
                Trainings aimed at this goal: {wig.trainings.map((t) => t.title).join(', ')}
              </div>
            )}

            {state.error ? <div className="login-error" style={{ marginTop: 14 }}>{state.error}</div> : null}
            {state.text ? (
              <div className="ai-summary" style={{ marginTop: 14, marginBottom: 0 }}>
                <span className="tag">AI impact interpretation</span>
                <div style={{ whiteSpace: 'pre-line' }}>{state.text}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
