'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LEVELS } from '../lib/evaluationConfig';

export default function FeedbackViewer() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [summary, setSummary] = useState('');
  const [summarising, setSummarising] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    async function loadList() {
      const { data: ev } = await supabase
        .from('evaluations')
        .select('id, level, status, training_id, trainings(title)')
        .order('launched_at', { ascending: false });

      const { data: resp } = await supabase.from('evaluation_responses').select('evaluation_id, status');
      const counts = {};
      (resp || []).forEach((r) => {
        if (r.status === 'submitted') counts[r.evaluation_id] = (counts[r.evaluation_id] || 0) + 1;
      });
      setEvaluations((ev || []).map((e) => ({ ...e, responses: counts[e.id] || 0 })));
      setLoading(false);
    }
    loadList();
  }, []);

  async function open(ev) {
    setSelected(ev);
    setSummary('');
    setAiError('');
    setDetail(null);
    setLoadingDetail(true);

    const named = ev.level === 3 || ev.level === 4;

    const { data: questions } = await supabase
      .from('evaluation_questions')
      .select('id, question_text, question_type, question_order, section')
      .eq('evaluation_id', ev.id)
      .order('question_order');

    // Privacy by design: for anonymous levels we never even fetch names.
    const sel = named ? 'id, submitted_at, profiles(full_name)' : 'id, submitted_at';
    const { data: responses } = await supabase
      .from('evaluation_responses')
      .select(sel)
      .eq('evaluation_id', ev.id)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true });

    const respIds = (responses || []).map((r) => r.id);
    let answers = [];
    if (respIds.length) {
      const { data: a } = await supabase
        .from('response_answers')
        .select('response_id, question_id, answer_text, answer_numeric')
        .in('response_id', respIds);
      answers = a || [];
    }

    const byResp = {};
    answers.forEach((a) => {
      if (!byResp[a.response_id]) byResp[a.response_id] = {};
      byResp[a.response_id][a.question_id] = a;
    });

    const respList = (responses || []).map((r, i) => ({
      label: named ? r.profiles?.full_name || 'Unknown' : `Respondent ${i + 1}`,
      answers: byResp[r.id] || {},
    }));

    setDetail({ questions: questions || [], responses: respList, named });
    setLoadingDetail(false);
  }

  async function summarise() {
    if (!detail) return;
    setSummarising(true);
    setAiError('');

    const comments = [];
    let s = 0;
    let n = 0;
    detail.responses.forEach((r) => {
      detail.questions.forEach((q) => {
        const a = r.answers[q.id];
        if (!a) return;
        if (a.answer_text) comments.push(`${q.question_text} — ${a.answer_text}`);
        if (a.answer_numeric !== null && a.answer_numeric !== undefined) {
          s += Number(a.answer_numeric);
          n += 1;
        }
      });
    });
    const scoreNote = n ? `Average score across rated questions: ${(s / n).toFixed(1)}/5 (${n} ratings).` : '';

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'feedback_summary',
          data: {
            title: selected.trainings?.title,
            level: selected.level,
            levelName: LEVELS[selected.level]?.name,
            scoreNote,
            comments: comments.slice(0, 60),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) setAiError(json.error || 'Could not summarise.');
      else setSummary(json.text);
    } catch (e) {
      setAiError('Could not reach the AI service.');
    }
    setSummarising(false);
  }

  if (loading) return <div className="center-note">Loading…</div>;

  // ---- Detail view ----
  if (selected) {
    return (
      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ marginBottom: 2 }}>{selected.trainings?.title}</h2>
            <div className="field-hint" style={{ margin: 0 }}>
              Level {selected.level} — {LEVELS[selected.level]?.name}
              {detail ? ` · ${detail.responses.length} responses · ${detail.named ? 'named' : 'anonymous'}` : ''}
            </div>
          </div>
          <button className="btn-small" onClick={() => { setSelected(null); setDetail(null); }}>Back</button>
        </div>

        {loadingDetail || !detail ? (
          <div className="center-note">Loading responses…</div>
        ) : (
          <>
            <div className="ai-summary-bar">
              <button
                className="btn-small primary-small"
                onClick={summarise}
                disabled={summarising || detail.responses.length === 0}
              >
                {summarising ? 'Summarising…' : '✨ Summarise with AI'}
              </button>
              {!detail.named && <span className="field-hint">Responses are anonymous at this level.</span>}
            </div>

            {aiError ? <div className="login-error" style={{ marginBottom: 12 }}>{aiError}</div> : null}
            {summary ? (
              <div className="ai-summary">
                <span className="tag">AI summary</span>
                <div style={{ whiteSpace: 'pre-line' }}>{summary}</div>
              </div>
            ) : null}

            {detail.responses.length === 0 ? (
              <div className="empty">No submitted responses yet.</div>
            ) : (
              detail.responses.map((r, i) => (
                <div key={i} className="resp-block">
                  <div className="resp-name">{r.label}</div>
                  {detail.questions.map((q) => {
                    const a = r.answers[q.id];
                    const val = a
                      ? a.answer_text || (a.answer_numeric !== null && a.answer_numeric !== undefined ? `${a.answer_numeric} / 5` : '—')
                      : '—';
                    return (
                      <div key={q.id} className="qa">
                        <div className="qa-q">{q.question_text}</div>
                        <div className="qa-a">{val}</div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </>
        )}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="card">
      <h2>Evaluation feedback</h2>
      <div className="field-hint" style={{ marginBottom: 12 }}>
        Levels 1–2 are shown anonymously to keep reaction and learning feedback honest.
        Levels 3–4 show names, since behaviour and results need attribution.
      </div>
      {evaluations.length === 0 ? (
        <div className="empty">No evaluations yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Training</th>
              <th>Level</th>
              <th style={{ textAlign: 'center' }}>Responses</th>
              <th style={{ textAlign: 'right' }}>View</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.trainings?.title}</td>
                <td>
                  L{ev.level} — {LEVELS[ev.level]?.name}{' '}
                  <span className="kind-tag">{ev.level === 1 || ev.level === 2 ? 'anon' : 'named'}</span>
                </td>
                <td style={{ textAlign: 'center' }}><span className="count-chip">{ev.responses}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="link-btn" onClick={() => open(ev)} disabled={ev.responses === 0}>Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
