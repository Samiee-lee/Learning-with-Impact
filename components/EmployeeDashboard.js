'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

export default function EmployeeDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [myTrainings, setMyTrainings] = useState([]);
  const [evals, setEvals] = useState([]); // launched evals for my trainings, with my completion state
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    async function load() {
      // My assigned trainings
      const { data: assigns } = await supabase
        .from('training_assignments')
        .select('training_id, trainings(id, title, status, wigs(name))')
        .eq('employee_id', profile.id);

      const trainings = (assigns || []).map((a) => a.trainings).filter(Boolean);
      setMyTrainings(trainings);

      const trainingIds = trainings.map((t) => t.id);

      // Launched evaluations for those trainings
      let launched = [];
      if (trainingIds.length) {
        const { data: ev } = await supabase
          .from('evaluations')
          .select('id, level, status, trainings(title)')
          .in('training_id', trainingIds)
          .eq('status', 'launched');
        launched = ev || [];
      }

      // My responses (which evaluations I've submitted)
      const { data: myResp } = await supabase
        .from('evaluation_responses')
        .select('evaluation_id, status')
        .eq('respondent_id', profile.id);

      const submittedSet = new Set(
        (myResp || []).filter((r) => r.status === 'submitted').map((r) => r.evaluation_id)
      );
      setCompletedCount(submittedSet.size);

      const withState = launched.map((ev) => ({
        ...ev,
        done: submittedSet.has(ev.id),
      }));
      setEvals(withState);

      setLoading(false);
    }
    load();
  }, [profile.id]);

  if (loading) return <div className="center-note">Loading…</div>;

  const levelName = { 1: 'Reaction', 2: 'Learning', 3: 'Behaviour', 4: 'Results' };
  const pending = evals.filter((e) => !e.done);

  return (
    <div className="page">
      <div className="welcome">
        <h1>Your learning</h1>
        <p>Trainings you're enrolled in and evaluations awaiting your input.</p>
      </div>

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
                <tr><th>Training</th><th>Level</th><th>Action</th></tr>
              </thead>
              <tbody>
                {pending.map((e) => (
                  <tr key={e.id}>
                    <td>{e.trainings?.title}</td>
                    <td>Level {e.level} — {levelName[e.level]}</td>
                    <td><span className="pill pending">Pending</span></td>
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
