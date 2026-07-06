'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ManagerDashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [validations, setValidations] = useState([]);

  useEffect(() => {
    async function load() {
      // Direct reports
      const { data: reports } = await supabase
        .from('profiles')
        .select('id, full_name, department, role')
        .eq('manager_id', profile.id);
      setTeam(reports || []);

      // Behaviour (Level 3) validations assigned to me
      const { data: vals } = await supabase
        .from('manager_validations')
        .select('id, validated, comments, evaluation_responses(profiles(full_name), evaluations(trainings(title)))')
        .eq('validator_id', profile.id);
      setValidations(vals || []);

      setLoading(false);
    }
    load();
  }, [profile.id]);

  if (loading) return <div className="center-note">Loading…</div>;

  const pending = validations.filter((v) => !v.validated).length;

  return (
    <div className="page">
      <div className="welcome">
        <h1>Team overview</h1>
        <p>Your direct reports and the behaviour changes awaiting your validation.</p>
      </div>

      <div className="stats">
        <div className="stat"><div className="value">{team.length}</div><div className="label">Team members</div></div>
        <div className="stat"><div className="value">{validations.length}</div><div className="label">Validation requests</div></div>
        <div className="stat"><div className="value">{pending}</div><div className="label">Pending validation</div></div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Behaviour validations</h2>
          {validations.length === 0 ? (
            <div className="empty">No validation requests yet.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Team member</th><th>Training</th><th>Status</th></tr>
              </thead>
              <tbody>
                {validations.map((v) => (
                  <tr key={v.id}>
                    <td>{v.evaluation_responses?.profiles?.full_name || '—'}</td>
                    <td>{v.evaluation_responses?.evaluations?.trainings?.title || '—'}</td>
                    <td>
                      {v.validated
                        ? <span className="pill completed">Validated</span>
                        : <span className="pill pending">Pending</span>}
                    </td>
                  </tr>
                ))}
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
              <thead>
                <tr><th>Name</th><th>Department</th></tr>
              </thead>
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
      </div>
    </div>
  );
}
