'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';
import { LEVELS } from '../lib/evaluationConfig';
import EvaluationForm from './EvaluationForm';

export default function EmployeeDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [myTrainings, setMyTrainings] = useState([]);
  const [evals, setEvals] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [active, setActive] = useState(null); // evaluation currently being taken
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    const { data: assigns } = await supabase
      .from('training_assignments')
      .select('training_id, trainings(id, title, status, wigs(name))')
      .eq('employee_id', profile.id);

    const trainings = (assigns || []).map((a) => a.trainings).filter(Boolean);
    setMyTrainings(trainings);

    const trainingIds = new Set(trainings.map((t) => t.id));

    // Fetch every launched evaluation, then keep only the ones that target me.
    const { data: allEv } = await supabase
      .from('evaluations')
      .select('id, level, status, scope, scope_ref, training_id, trainings(title)')
      .eq('status', 'launched');

    const launched = (allEv || []).filter((ev) => {
      switch (ev.scope) {
        case 'organization':
          return true;
        case 'department':
          return !!profile.department && ev.scope_ref === profile.department;
        case 'employee':
          return ev.scope_ref === profile.id;
        case 'programme':
        default:
          return trainingIds.has(ev.training_id);
      }
    });

    const { data: myResp } = await supabase
      .from('evaluation_responses')
      .select('evaluation_id, status')
      .eq('respondent_id', profile.id);

    const submittedSet = new Set(
      (myResp || []).filter((r) => r.status === 'submitted').map((r) => r.evaluation_id)
    );
    setCompletedCount(submittedSet.size);

    setEvals(launched.map((ev) => ({ ...ev, done: submittedSet.has(ev.id) })));
    setLoading(false);
  }, [profile.id, profile.department]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDone() {
    setActive(null);
    setToast('Evaluation submitted. Thank you!');
    await load();
    setTimeout(() => setToast(''), 4000);
  }

  if (loading) return <div className="center-note">Loading…</div>;

  // Taking an evaluation replaces the dashboard view
  if (active) {
    return (
      <div className="page">
        <EvaluationForm
          evaluation={active}
          profile={profile}
          onDone={handleDone}
          onCancel={() => setActive(null)}
        />
      </div>
    );
  }

  const pending = evals.filter((e) => !e.done);

  return (
    <div className="page">
      <div className="welcome">
        <h1>Your learning</h1>
        <p>Trainings you're enrolled in and evaluations awaiting your input.</p>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}

      <div className="stats">
        <div className="stat"><div className="value">{myTrainings.length}</div><div className="label">My trainings</div></div>
        <div className="stat"><div className="value">{pending.length}</div><div className="label">Evaluations to complete</div></div>
        <div className="stat"><div className="value">{completedCount}</div><div className="label">Completed</div></div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Evaluations to complete</h2>
          {pending.length === 0 ? (
            <div className="empty">You're all caught up — nothing pending. 🎉</div>
          ) : (
            <table>
              <thead>
                <tr><th>Training</th><th>Level</th><th style={{ textAlign: 'right' }}>Action</th></tr>
              </thead>
              <tbody>
                {pending.map((e) => (
                  <tr key={e.id}>
                    <td>{e.trainings?.title}</td>
                    <td>Level {e.level} — {LEVELS[e.level]?.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-small" onClick={() => setActive(e)}>Start</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>My trainings</h2>
          {myTrainings.length === 0 ? (
            <div className="empty">No trainings assigned yet.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Training</th><th>WIG</th></tr>
              </thead>
              <tbody>
                {myTrainings.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{pretty(t.wigs?.name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
