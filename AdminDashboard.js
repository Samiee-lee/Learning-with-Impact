'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LEVELS, SCALE, isNumericType } from '../lib/evaluationConfig';

export default function EvaluationForm({ evaluation, profile, onDone, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // question_id -> value
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: qs } = await supabase
        .from('evaluation_questions')
        .select('id, question_text, question_type, question_order')
        .eq('evaluation_id', evaluation.id)
        .order('question_order');
      setQuestions(qs || []);
      setLoading(false);
    }
    load();
  }, [evaluation.id]);

  function setAnswer(qid, value) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg('');

    // Require every question answered
    const unanswered = questions.filter((q) => {
      const v = answers[q.id];
      return v === undefined || v === null || String(v).trim() === '';
    });
    if (unanswered.length) {
      setMsg(`Please answer all ${questions.length} questions before submitting.`);
      return;
    }

    setSaving(true);

    // 1. Create (or find) my response row
    const { data: resp, error: rErr } = await supabase
      .from('evaluation_responses')
      .insert({
        evaluation_id: evaluation.id,
        respondent_id: profile.id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (rErr || !resp) {
      setSaving(false);
      const dup = rErr?.code === '23505' || /duplicate|unique/i.test(rErr?.message || '');
      setMsg(
        dup
          ? 'You have already submitted this evaluation.'
          : 'Could not submit: ' + (rErr?.message || 'unknown error')
      );
      return;
    }

    // 2. Save each answer in the right column
    const rows = questions.map((q) => {
      const raw = answers[q.id];
      return isNumericType(q.question_type)
        ? { response_id: resp.id, question_id: q.id, answer_numeric: Number(raw) }
        : { response_id: resp.id, question_id: q.id, answer_text: String(raw).trim() };
    });

    const { error: aErr } = await supabase.from('response_answers').insert(rows);
    if (aErr) {
      setSaving(false);
      setMsg('Answers failed to save: ' + aErr.message);
      return;
    }

    // 3. Level 3 (Behaviour) needs manager validation — create the request
    if (evaluation.level === 3 && profile.manager_id) {
      await supabase.from('manager_validations').insert({
        response_id: resp.id,
        validator_id: profile.manager_id,
        validated: false,
      });
    }

    setSaving(false);
    if (onDone) onDone();
  }

  if (loading) return <div className="center-note">Loading questions…</div>;

  const levelMeta = LEVELS[evaluation.level] || {};

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 style={{ marginBottom: 2 }}>{evaluation.trainings?.title}</h2>
          <div className="field-hint" style={{ margin: 0 }}>
            Level {evaluation.level} — {levelMeta.name}: {levelMeta.blurb}
          </div>
        </div>
        <button className="btn-small" onClick={onCancel}>Back</button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 6 }}>
        {msg ? <div className="login-error" style={{ marginBottom: 16 }}>{msg}</div> : null}

        {questions.map((q, i) => (
          <div key={q.id} className="question-block">
            <div className="question-text">
              <span className="q-num">{i + 1}.</span> {q.question_text}
            </div>

            {isNumericType(q.question_type) ? (
              <div className="scale">
                {SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`scale-btn ${Number(answers[q.id]) === n ? 'selected' : ''}`}
                    onClick={() => setAnswer(q.id, n)}
                  >
                    {n}
                  </button>
                ))}
                <span className="scale-hint">
                  {q.question_type === 'confidence' ? '1 = not confident, 5 = very confident' : '1 = poor, 5 = excellent'}
                </span>
              </div>
            ) : (
              <textarea
                className="answer-text"
                rows={q.question_type === 'scenario' ? 4 : 3}
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer…"
              />
            )}
          </div>
        ))}

        {questions.length === 0 && (
          <div className="empty">This evaluation has no questions yet.</div>
        )}

        {questions.length > 0 && (
          <button
            type="submit"
            className="btn-primary"
            style={{ width: 'auto', padding: '11px 26px', marginTop: 8 }}
            disabled={saving}
          >
            {saving ? 'Submitting…' : 'Submit evaluation'}
          </button>
        )}
      </form>
    </div>
  );
}
