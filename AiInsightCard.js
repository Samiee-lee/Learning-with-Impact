'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LEVELS, DEFAULT_QUESTIONS, SCOPES } from '../lib/evaluationConfig';

export default function EvaluationManager({ profile, onChanged, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [responseCounts, setResponseCounts] = useState({}); // eval_id -> submitted count

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [level, setLevel] = useState('1');
  const [scope, setScope] = useState('programme');

  async function loadData() {
    const { data: ev } = await supabase
      .from('evaluations')
      .select('id, level, scope, status, launched_at, training_id, trainings(title)')
      .order('launched_at', { ascending: false });
    setEvaluations(ev || []);

    const { data: tr } = await supabase
      .from('trainings')
      .select('id, title')
      .order('title');
    setTrainings(tr || []);

    const { data: resp } = await supabase
      .from('evaluation_responses')
      .select('evaluation_id, status');
    const counts = {};
    (resp || []).forEach((r) => {
      if (r.status === 'submitted') {
        counts[r.evaluation_id] = (counts[r.evaluation_id] || 0) + 1;
      }
    });
    setResponseCounts(counts);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  async function handleLaunch(e) {
    e.preventDefault();
    setMsg('');
    if (!trainingId) {
      setMsg('Please choose a training.');
      return;
    }
    setSaving(true);

    // Guard: don't launch the same level twice for the same training
    const { data: existing } = await supabase
      .from('evaluations')
      .select('id')
      .eq('training_id', trainingId)
      .eq('level', Number(level))
      .maybeSingle();

    if (existing) {
      setSaving(false);
      setMsg(`Level ${level} has already been launched for this training.`);
      return;
    }

    // 1. Create the evaluation
    const { data: created, error } = await supabase
      .from('evaluations')
      .insert({
        training_id: trainingId,
        level: Number(level),
        scope,
        status: 'launched',
        launched_by: profile.id,
        launched_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !created) {
      setSaving(false);
      setMsg('Could not launch: ' + (error?.message || 'unknown error'));
      return;
    }

    // 2. Attach the default questions for that level
    const questions = (DEFAULT_QUESTIONS[Number(level)] || []).map((q, i) => ({
      evaluation_id: created.id,
      question_text: q.question_text,
      question_type: q.question_type,
      question_order: i + 1,
      ai_generated: false,
    }));

    if (questions.length) {
      const { error: qErr } = await supabase.from('evaluation_questions').insert(questions);
      if (qErr) {
        setSaving(false);
        setMsg('Evaluation created, but questions failed: ' + qErr.message);
        return;
      }
    }

    setSaving(false);
    setFormOpen(false);
    setTrainingId('');
    setLevel('1');
    setScope('programme');
    await loadData();
    if (onChanged) onChanged();
  }

  async function toggleStatus(ev) {
    const next = ev.status === 'launched' ? 'closed' : 'launched';
    const { error } = await supabase.from('evaluations').update({ status: next }).eq('id', ev.id);
    if (error) {
      alert('Could not update: ' + error.message);
      return;
    }
    await loadData();
    if (onChanged) onChanged();
  }

  async function handleDelete(ev) {
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(
        `Delete the Level ${ev.level} evaluation for "${ev.trainings?.title}"?\n\n` +
          `All questions and participant responses for it will be permanently removed.`
      );
    if (!ok) return;

    const { error } = await supabase.from('evaluations').delete().eq('id', ev.id);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    await loadData();
    if (onChanged) onChanged();
  }

  if (loading) return <div className="center-note">Loading…</div>;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Evaluations</h2>
        {formOpen ? (
          <button className="btn-small" onClick={() => { setFormOpen(false); setMsg(''); }}>Cancel</button>
        ) : (
          <button className="btn-small" onClick={() => setFormOpen(true)}>+ Launch evaluation</button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleLaunch} className="inline-form">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Launch a new evaluation</div>
          {msg ? <div className="login-error" style={{ marginBottom: 14 }}>{msg}</div> : null}
          <div className="form-grid">
            <div className="field field-wide">
              <label>Training</label>
              <select value={trainingId} onChange={(e) => setTrainingId(e.target.value)}>
                <option value="">— select a training —</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {[1, 2, 3, 4].map((l) => (
                  <option key={l} value={l}>Level {l} — {LEVELS[l].name}</option>
                ))}
              </select>
              <div className="field-hint">{LEVELS[Number(level)].blurb}</div>
            </div>
            <div className="field">
              <label>Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                {SCOPES.map((s) => (
                  <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 22px' }} disabled={saving}>
            {saving ? 'Launching…' : 'Launch evaluation'}
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Training</th>
            <th>Level</th>
            <th>Scope</th>
            <th style={{ textAlign: 'center' }}>Responses</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((ev) => (
            <tr key={ev.id}>
              <td>{ev.trainings?.title || '—'}</td>
              <td>L{ev.level} — {LEVELS[ev.level]?.name}</td>
              <td style={{ textTransform: 'capitalize' }}>{ev.scope}</td>
              <td style={{ textAlign: 'center' }}>
                <span className="count-chip">{responseCounts[ev.id] || 0}</span>
              </td>
              <td><span className={`pill ${ev.status}`}>{ev.status}</span></td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="link-btn" onClick={() => toggleStatus(ev)}>
                  {ev.status === 'launched' ? 'Close' : 'Reopen'}
                </button>
                <button className="link-btn danger" onClick={() => handleDelete(ev)}>Delete</button>
              </td>
            </tr>
          ))}
          {evaluations.length === 0 && (
            <tr><td colSpan={6} className="empty">No evaluations yet. Click “Launch evaluation”.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
