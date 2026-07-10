'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LEVELS, DEFAULT_QUESTIONS, SCOPES, buildLevel1 } from '../lib/evaluationConfig';

const SCOPE_HINTS = {
  programme: 'Everyone enrolled in this training',
  department: 'Every employee in one department',
  organization: 'Every employee in the organisation',
  employee: 'One specific person',
};

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
  const [scopeRef, setScopeRef] = useState('');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // AI Evaluation Builder
  const [draftQuestions, setDraftQuestions] = useState(null); // null = not generated yet
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  async function loadData() {
    const { data: ev } = await supabase
      .from('evaluations')
      .select('id, level, scope, scope_ref, status, launched_at, training_id, trainings(title)')
      .order('launched_at', { ascending: false });
    setEvaluations(ev || []);

    const { data: tr } = await supabase
      .from('trainings')
      .select('id, title, one_line_objective, target_audience, delivery_mode, wigs(name)')
      .order('title');
    setTrainings(tr || []);

    const { data: emp } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .eq('role', 'employee')
      .order('full_name');
    setEmployees(emp || []);
    setDepartments([...new Set((emp || []).map((e) => e.department).filter(Boolean))].sort());

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

  const selectedTraining = trainings.find((x) => x.id === trainingId);
  const isLevel1 = Number(level) === 1;

  // Level 1 uses the fixed standard instrument, tailored to delivery mode.
  useEffect(() => {
    if (isLevel1 && selectedTraining) {
      setAiError('');
      setDraftQuestions(buildLevel1(selectedTraining.delivery_mode || 'physical'));
    } else if (isLevel1) {
      setDraftQuestions(null);
    }
  }, [isLevel1, trainingId, selectedTraining?.delivery_mode]);

  function useDefaults() {
    setAiError('');
    setDraftQuestions((DEFAULT_QUESTIONS[Number(level)] || []).map((q) => ({ ...q })));
  }

  async function generateQuestions() {
    setAiError('');
    if (!trainingId) {
      setMsg('Choose a training first — the AI writes questions from its objective.');
      return;
    }
    const t = trainings.find((x) => x.id === trainingId);
    setGenerating(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'questions',
          data: {
            level: Number(level),
            title: t?.title,
            objective: t?.one_line_objective,
            wig: t?.wigs?.name,
            audience: t?.target_audience,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error || 'Could not generate questions.');
      } else {
        setDraftQuestions(json.questions.map((q) => ({ ...q, ai_generated: true })));
      }
    } catch (err) {
      setAiError('Could not reach the AI service. Please try again.');
    }
    setGenerating(false);
  }

  function updateDraft(i, key, value) {
    setDraftQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, [key]: value } : q)));
  }

  function removeDraft(i) {
    setDraftQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  function addDraft() {
    setDraftQuestions((qs) => [...(qs || []), { question_text: '', question_type: 'text' }]);
  }

  async function handleLaunch(e) {
    e.preventDefault();
    setMsg('');

    if (!trainingId) {
      setMsg('Please choose a training.');
      return;
    }
    if ((scope === 'employee' || scope === 'department') && !scopeRef) {
      setMsg(scope === 'employee' ? 'Please choose an employee.' : 'Please choose a department.');
      return;
    }
    if (!draftQuestions || draftQuestions.length === 0) {
      setMsg('Generate the questions (or use the standard set) before launching.');
      return;
    }
    if (draftQuestions.some((q) => !q.question_text.trim())) {
      setMsg('Every question needs text. Remove any blank ones.');
      return;
    }

    setSaving(true);

    // Only 'employee' and 'department' scopes have a specific target.
    const ref = scope === 'employee' || scope === 'department' ? scopeRef : null;

    // Block only an EXACT duplicate: same training + level + scope + target.
    let dupQuery = supabase
      .from('evaluations')
      .select('id')
      .eq('training_id', trainingId)
      .eq('level', Number(level))
      .eq('scope', scope);
    dupQuery = ref ? dupQuery.eq('scope_ref', ref) : dupQuery.is('scope_ref', null);

    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      setSaving(false);
      setMsg(`That exact Level ${level} evaluation has already been launched.`);
      return;
    }

    // 1. Create the evaluation
    const { data: created, error } = await supabase
      .from('evaluations')
      .insert({
        training_id: trainingId,
        level: Number(level),
        scope,
        scope_ref: ref,
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

    // 2. Attach the questions (AI-generated or standard, as edited)
    const questions = draftQuestions.map((q, i) => ({
      evaluation_id: created.id,
      question_text: q.question_text.trim(),
      question_type: q.question_type,
      question_order: i + 1,
      section: q.section || null,
      reverse_scored: !!q.reverse_scored,
      ai_generated: !!q.ai_generated,
    }));

    const { error: qErr } = await supabase.from('evaluation_questions').insert(questions);
    if (qErr) {
      setSaving(false);
      setMsg('Evaluation created, but questions failed: ' + qErr.message);
      return;
    }

    setSaving(false);
    setFormOpen(false);
    setTrainingId('');
    setLevel('1');
    setScope('programme');
    setScopeRef('');
    setDraftQuestions(null);
    setAiError('');
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
          <button className="btn-small" onClick={() => { setFormOpen(false); setMsg(''); setDraftQuestions(null); setAiError(''); }}>Cancel</button>
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
              <select value={trainingId} onChange={(e) => { setTrainingId(e.target.value); setDraftQuestions(null); }}>
                <option value="">— select a training —</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Level</label>
              <select value={level} onChange={(e) => { setLevel(e.target.value); setDraftQuestions(null); }}>
                {[1, 2, 3, 4].map((l) => (
                  <option key={l} value={l}>Level {l} — {LEVELS[l].name}</option>
                ))}
              </select>
              <div className="field-hint">{LEVELS[Number(level)].blurb}</div>
            </div>
            <div className="field">
              <label>Scope</label>
              <select
                value={scope}
                onChange={(e) => { setScope(e.target.value); setScopeRef(''); }}
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>
                ))}
              </select>
              <div className="field-hint">{SCOPE_HINTS[scope]}</div>
            </div>

            {scope === 'employee' && (
              <div className="field field-wide">
                <label>Which employee?</label>
                <select value={scopeRef} onChange={(e) => setScopeRef(e.target.value)}>
                  <option value="">— select an employee —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}{emp.department ? ` (${emp.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'department' && (
              <div className="field field-wide">
                <label>Which department?</label>
                <select value={scopeRef} onChange={(e) => setScopeRef(e.target.value)}>
                  <option value="">— select a department —</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="builder">
            <div className="builder-head">
              <div>
                <div className="builder-title">Evaluation questions</div>
                <div className="field-hint" style={{ marginTop: 2 }}>
                  {isLevel1
                    ? 'Level 1 uses the standard instrument so results stay comparable across programmes. Platform questions appear only for virtual or blended delivery.'
                    : "Claude writes these from the training's objective. Edit anything before you launch."}
                </div>
              </div>
              {!isLevel1 && (
                <div style={{ display: 'flex', gap: 8, whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn-small" onClick={useDefaults} disabled={generating}>
                    Use standard set
                  </button>
                  <button type="button" className="btn-small primary-small" onClick={generateQuestions} disabled={generating}>
                    {generating ? 'Generating…' : '✨ Generate with AI'}
                  </button>
                </div>
              )}
            </div>

            {aiError ? <div className="login-error" style={{ marginBottom: 12 }}>{aiError}</div> : null}

            {draftQuestions === null ? (
              <div className="empty" style={{ padding: '14px 2px' }}>
                {isLevel1
                  ? 'Choose a training — its standard Level 1 questions will load automatically.'
                  : 'No questions yet — generate them with AI, or use the standard set for this level.'}
              </div>
            ) : isLevel1 ? (
              <div className="l1-preview">
                <div className="field-hint" style={{ marginBottom: 8 }}>
                  {draftQuestions.length} questions
                  {selectedTraining ? ` · ${selectedTraining.delivery_mode || 'physical'} delivery` : ''}
                </div>
                {draftQuestions.map((q, i) => (
                  <div key={i} className="l1-row">
                    <span className="l1-section">{q.section}</span>
                    <span>{q.question_text}</span>
                    {q.reverse_scored ? <span className="rev-tag" title="Reverse scored: “Yes” is the unfavourable answer">rev</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {draftQuestions.map((q, i) => (
                  <div key={i} className="draft-q">
                    <span className="q-num">{i + 1}.</span>
                    <input
                      className="draft-input"
                      value={q.question_text}
                      placeholder="Question text"
                      onChange={(e) => updateDraft(i, 'question_text', e.target.value)}
                    />
                    <select
                      className="draft-type"
                      value={q.question_type}
                      onChange={(e) => updateDraft(i, 'question_type', e.target.value)}
                    >
                      <option value="rating">Rating 1–5</option>
                      <option value="confidence">Confidence 1–5</option>
                      <option value="text">Text</option>
                      <option value="scenario">Scenario</option>
                    </select>
                    <button type="button" className="link-btn danger" onClick={() => removeDraft(i)}>Remove</button>
                  </div>
                ))}
                <button type="button" className="link-btn" onClick={addDraft} style={{ marginTop: 6 }}>
                  + Add a question
                </button>
              </>
            )}
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
              <td style={{ textTransform: 'capitalize' }}>
                {ev.scope}
                {ev.scope_ref ? (
                  <div className="field-hint" style={{ marginTop: 2 }}>
                    {ev.scope === 'employee'
                      ? employees.find((e) => e.id === ev.scope_ref)?.full_name || 'employee'
                      : ev.scope_ref}
                  </div>
                ) : null}
              </td>
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
