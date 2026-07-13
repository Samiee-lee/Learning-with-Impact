'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AppShell from './AppShell';

const NAV = [{ key: 'team', label: 'My team', icon: 'team' }];

export default function ManagerDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [validations, setValidations] = useState([]);
  const [openId, setOpenId] = useState(null);   // which validation is expanded
  const [comments, setComments] = useState({}); // validation_id -> comment text
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    const { data: reports } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .eq('manager_id', profile.id);
    setTeam(reports || []);

    const { data: vals } = await supabase
      .from('manager_validations')
      .select(
        'id, validated, comments, response_id, ' +
          'evaluation_responses(id, respondent_id, profiles(full_name), evaluations(level, trainings(title)))'
      )
      .eq('validator_id', profile.id);
    setValidations(vals || []);

    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Load the employee's actual answers when a row is expanded
  const [answers, setAnswers] = useState({}); // response_id -> [{q, a}]
  async function toggleOpen(v) {
    if (openId === v.id) {
      setOpenId(null);
      return;
    }
    setOpenId(v.id);
    const rid = v.response_id;
    if (!answers[rid]) {
      const { data } = await supabase
        .from('response_answers')
        .select('answer_text, answer_numeric, evaluation_questions(question_text, question_order)')
        .eq('response_id', rid);
      const sorted = (data || []).sort(
        (a, b) => (a.evaluation_questions?.question_order || 0) - (b.evaluation_questions?.question_order || 0)
      );
      setAnswers((prev) => ({ ...prev, [rid]: sorted }));
    }
  }

  async function handleValidate(v) {
    setSaving(true);
    const { error } = await supabase
      .from('manager_validations')
      .update({
        validated: true,
        comments: (comments[v.id] || '').trim() || null,
        validated_at: new Date().toISOString(),
      })
      .eq('id', v.id);
    setSaving(false);

    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    setOpenId(null);
    setToast('Behaviour change validated.');
    await load();
    setTimeout(() => setToast(''), 4000);
  }

  if (loading) return <div className="center-note">Loading…</div>;

  const pending = validations.filter((v) => !v.validated);

  return (
    <AppShell profile={profile} nav={NAV} active="team" onSelect={() => {}} title="Team overview" subtitle="Your direct reports and the behaviour changes awaiting your validation.">

      {toast ? <div className="toast">{toast}</div> : null}

      <div className="stats">
        <div className="stat"><div className="value">{team.length}</div><div className="label">Team members</div></div>
        <div className="stat"><div className="value">{validations.length}</div><div className="label">Validation requests</div></div>
        <div className="stat"><div className="value">{pending.length}</div><div className="label">Pending validation</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Behaviour validations</h2>
        {validations.length === 0 ? (
          <div className="empty">No validation requests yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Team member</th><th>Training</th><th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {validations.map((v) => {
                const resp = v.evaluation_responses;
                const rid = v.response_id;
                const isOpen = openId === v.id;
                return (
                  <Fragment key={v.id}>
                    <tr>
                      <td>{resp?.profiles?.full_name || '—'}</td>
                      <td>{resp?.evaluations?.trainings?.title || '—'}</td>
                      <td>
                        {v.validated
                          ? <span className="pill completed">Validated</span>
                          : <span className="pill pending">Pending</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="link-btn" onClick={() => toggleOpen(v)}>
                          {isOpen ? 'Hide' : v.validated ? 'View' : 'Review'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={4} className="detail-cell">
                          <div className="detail-box">
                            <div className="detail-title">What they reported</div>
                            {(answers[rid] || []).length === 0 ? (
                              <div className="empty" style={{ padding: '6px 0' }}>Loading answers…</div>
                            ) : (
                              (answers[rid] || []).map((a, i) => (
                                <div key={i} className="qa">
                                  <div className="qa-q">{a.evaluation_questions?.question_text}</div>
                                  <div className="qa-a">
                                    {a.answer_text || (a.answer_numeric != null ? `${a.answer_numeric} / 5` : '—')}
                                  </div>
                                </div>
                              ))
                            )}

                            {v.validated ? (
                              v.comments ? (
                                <div className="qa" style={{ marginTop: 12 }}>
                                  <div className="qa-q">Your comment</div>
                                  <div className="qa-a">{v.comments}</div>
                                </div>
                              ) : null
                            ) : (
                              <div style={{ marginTop: 14 }}>
                                <div className="detail-title">Your validation</div>
                                <textarea
                                  className="answer-text"
                                  rows={3}
                                  placeholder="Confirm what you have observed on the job (optional)…"
                                  value={comments[v.id] || ''}
                                  onChange={(e) =>
                                    setComments((c) => ({ ...c, [v.id]: e.target.value }))
                                  }
                                />
                                <button
                                  className="btn-primary"
                                  style={{ width: 'auto', padding: '10px 22px' }}
                                  onClick={() => handleValidate(v)}
                                  disabled={saving}
                                >
                                  {saving ? 'Saving…' : 'Confirm behaviour change'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Your team</h2>
        {team.length === 0 ? (
          <div className="empty">No direct reports assigned.</div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Department</th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td>{m.full_name}</td>
                  <td>{m.department || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
