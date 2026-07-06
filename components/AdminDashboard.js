'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

export default function AdminDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ trainings: 0, wigs: 0, evals: 0, responses: 0 });
  const [trainings, setTrainings] = useState([]);
  const [wigs, setWigs] = useState([]);
  const [insight, setInsight] = useState('');

  // New-training form
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [ttype, setTtype] = useState('internal');
  const [wigId, setWigId] = useState('');
  const [audience, setAudience] = useState('');

  async function loadData() {
    const { data: tr } = await supabase
      .from('trainings')
      .select('id, title, training_type, status, wigs(name)')
      .order('created_at', { ascending: true });
    setTrainings(tr || []);

    const { data: w } = await supabase.from('wigs').select('id, name').order('name');
    setWigs(w || []);

    const [evalRes, respRes] = await Promise.all([
      supabase.from('evaluations').select('*', { count: 'exact', head: true }),
      supabase.from('evaluation_responses').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      trainings: (tr || []).length,
      wigs: (w || []).length,
      evals: evalRes.count || 0,
      responses: respRes.count || 0,
    });

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

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setMsg('');
    if (!title.trim() || !objective.trim()) {
      setMsg('Title and objective are required.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('trainings').insert({
      title: title.trim(),
      one_line_objective: objective.trim(),
      training_type: ttype,
      wig_id: wigId || null,
      target_audience: audience.trim() || null,
      status: 'draft',
      created_by: profile.id,
    });
    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return;
    }
    // reset + refresh
    setTitle('');
    setObjective('');
    setTtype('internal');
    setWigId('');
    setAudience('');
    setFormOpen(false);
    setMsg('');
    await loadData();
  }

  if (loading) return <div className="center-note">Loading…</div>;

  return (
    <div className="page">
      <div className="welcome">
        <h1>Admin console</h1>
        <p>Manage trainings, evaluations and reporting for the organisation.</p>
      </div>

      <div className="stats">
        <div className="stat"><div className="value">{stats.trainings}</div><div className="label">Trainings</div></div>
        <div className="stat"><div className="value">{stats.wigs}</div><div className="label">Strategic WIGs</div></div>
        <div className="stat"><div className="value">{stats.evals}</div><div className="label">Evaluations launched</div></div>
        <div className="stat"><div className="value">{stats.responses}</div><div className="label">Responses collected</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h2>Trainings</h2>
          <button className="btn-small" onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? 'Cancel' : '+ Register training'}
          </button>
        </div>

        {formOpen && (
          <form onSubmit={handleCreate} className="inline-form">
            {msg ? <div className="login-error" style={{ marginBottom: 14 }}>{msg}</div> : null}
            <div className="form-grid">
              <div className="field">
                <label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fraud Awareness Bootcamp" />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={ttype} onChange={(e) => setTtype(e.target.value)}>
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                </select>
              </div>
              <div className="field field-wide">
                <label>One-line objective</label>
                <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What should this training achieve?" />
              </div>
              <div className="field">
                <label>Linked WIG</label>
                <select value={wigId} onChange={(e) => setWigId(e.target.value)}>
                  <option value="">— select —</option>
                  {wigs.map((w) => (
                    <option key={w.id} value={w.id}>{pretty(w.name)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Target audience</label>
                <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Sales agents" />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 22px' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save training'}
            </button>
          </form>
        )}

        <table>
          <thead>
            <tr><th>Title</th><th>Type</th><th>WIG</th><th>Status</th></tr>
          </thead>
          <tbody>
            {trainings.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.training_type}</td>
                <td>{pretty(t.wigs?.name)}</td>
                <td><span className={`pill ${t.status}`}>{t.status}</span></td>
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
  );
}
