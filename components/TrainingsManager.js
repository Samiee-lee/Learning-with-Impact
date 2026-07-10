'use client';

import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

const EMPTY = {
  title: '', objective: '', ttype: 'internal', wigId: '', audience: '', status: 'draft',
  deliveryMode: 'physical', facilitator: '', facilitatorKind: 'individual',
};

export default function TrainingsManager({ profile, onChanged, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState([]);
  const [wigs, setWigs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState({}); // training_id -> Set(employee_id)

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(EMPTY);

  const [participantsFor, setParticipantsFor] = useState(null); // training id expanded
  const [savingParticipants, setSavingParticipants] = useState(false);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function loadData() {
    const { data: tr } = await supabase
      .from('trainings')
      .select('id, title, one_line_objective, training_type, status, target_audience, wig_id, delivery_mode, facilitator, facilitator_kind, wigs(name)')
      .order('created_at', { ascending: true });
    setTrainings(tr || []);

    const { data: w } = await supabase.from('wigs').select('id, name').order('name');
    setWigs(w || []);

    const { data: emp } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .eq('role', 'employee')
      .order('full_name');
    setEmployees(emp || []);

    const { data: asg } = await supabase.from('training_assignments').select('training_id, employee_id');
    const map = {};
    (asg || []).forEach((a) => {
      if (!map[a.training_id]) map[a.training_id] = new Set();
      map[a.training_id].add(a.employee_id);
    });
    setAssignments(map);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setMsg('');
    setFormOpen(true);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({
      title: t.title || '',
      objective: t.one_line_objective || '',
      ttype: t.training_type || 'internal',
      wigId: t.wig_id || '',
      audience: t.target_audience || '',
      status: t.status || 'draft',
      deliveryMode: t.delivery_mode || 'physical',
      facilitator: t.facilitator || '',
      facilitatorKind: t.facilitator_kind || 'individual',
    });
    setMsg('');
    setFormOpen(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    setMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg('');
    if (!form.title.trim() || !form.objective.trim()) {
      setMsg('Title and objective are required.');
      return;
    }
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      one_line_objective: form.objective.trim(),
      training_type: form.ttype,
      wig_id: form.wigId || null,
      target_audience: form.audience.trim() || null,
      status: form.status,
      delivery_mode: form.deliveryMode,
      facilitator: form.facilitator.trim() || null,
      facilitator_kind: form.facilitator.trim() ? form.facilitatorKind : null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('trainings').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('trainings').insert({ ...payload, created_by: profile.id }));
    }

    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return;
    }
    closeForm();
    await loadData();
    if (onChanged) onChanged();
  }

  async function handleDelete(t) {
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(
        `Delete "${t.title}"?\n\nThis also permanently removes any evaluations, responses and ` +
          `results linked to this training. This cannot be undone.`
      );
    if (!ok) return;

    const { error } = await supabase.from('trainings').delete().eq('id', t.id);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    await loadData();
    if (onChanged) onChanged();
  }

  function toggleParticipants(id) {
    setParticipantsFor(participantsFor === id ? null : id);
  }

  async function toggleAssignment(trainingId, employeeId) {
    setSavingParticipants(true);
    const current = assignments[trainingId] || new Set();
    const isAssigned = current.has(employeeId);

    if (isAssigned) {
      await supabase
        .from('training_assignments')
        .delete()
        .eq('training_id', trainingId)
        .eq('employee_id', employeeId);
    } else {
      await supabase
        .from('training_assignments')
        .insert({ training_id: trainingId, employee_id: employeeId });
    }

    await loadData();
    setSavingParticipants(false);
    if (onChanged) onChanged();
  }

  if (loading) return <div className="center-note">Loading…</div>;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Trainings</h2>
        {formOpen ? (
          <button className="btn-small" onClick={closeForm}>Cancel</button>
        ) : (
          <button className="btn-small" onClick={openCreate}>+ Register training</button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="inline-form">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            {editingId ? 'Edit training' : 'New training'}
          </div>
          {msg ? <div className="login-error" style={{ marginBottom: 14 }}>{msg}</div> : null}
          <div className="form-grid">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Fraud Awareness Bootcamp" />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={form.ttype} onChange={(e) => setField('ttype', e.target.value)}>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <div className="field field-wide">
              <label>One-line objective</label>
              <input value={form.objective} onChange={(e) => setField('objective', e.target.value)} placeholder="What should this training achieve?" />
            </div>
            <div className="field">
              <label>Linked WIG</label>
              <select value={form.wigId} onChange={(e) => setField('wigId', e.target.value)}>
                <option value="">— select —</option>
                {wigs.map((w) => (
                  <option key={w.id} value={w.id}>{pretty(w.name)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Target audience</label>
              <input value={form.audience} onChange={(e) => setField('audience', e.target.value)} placeholder="e.g. Sales agents" />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="field">
              <label>Delivery mode</label>
              <select value={form.deliveryMode} onChange={(e) => setField('deliveryMode', e.target.value)}>
                <option value="physical">Physical</option>
                <option value="virtual">Virtual</option>
                <option value="blended">Blended</option>
              </select>
              <div className="field-hint">Platform questions appear on Level 1 for virtual/blended only.</div>
            </div>
            <div className="field">
              <label>Facilitator / institution</label>
              <input
                value={form.facilitator}
                onChange={(e) => setField('facilitator', e.target.value)}
                placeholder="e.g. Dolapo Fasuyi, or Fitch Learning"
              />
            </div>
            <div className="field">
              <label>Facilitator type</label>
              <select
                value={form.facilitatorKind}
                onChange={(e) => setField('facilitatorKind', e.target.value)}
                disabled={!form.facilitator.trim()}
              >
                <option value="individual">Individual</option>
                <option value="institution">Institution</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 22px' }} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save training'}
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Title</th><th>Type</th><th>Facilitator</th><th>WIG</th>
            <th style={{ textAlign: 'center' }}>Participants</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {trainings.map((t) => {
            const assigned = assignments[t.id] || new Set();
            const isOpen = participantsFor === t.id;
            return (
              <Fragment key={t.id}>
                <tr>
                  <td>{t.title}</td>
                  <td style={{ textTransform: 'capitalize' }}>
                    {t.training_type}
                    <div className="field-hint" style={{ marginTop: 2 }}>{t.delivery_mode || 'physical'}</div>
                  </td>
                  <td>
                    {t.facilitator || <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td>{pretty(t.wigs?.name)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="link-btn" onClick={() => toggleParticipants(t.id)}>
                      <span className="count-chip">{assigned.size}</span>
                    </button>
                  </td>
                  <td><span className={`pill ${t.status}`}>{t.status}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="link-btn" onClick={() => toggleParticipants(t.id)}>
                      {isOpen ? 'Hide' : 'Participants'}
                    </button>
                    <button className="link-btn" onClick={() => startEdit(t)}>Edit</button>
                    <button className="link-btn danger" onClick={() => handleDelete(t)}>Delete</button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={7} className="detail-cell">
                      <div className="detail-box">
                        <div className="detail-title">
                          Who attended “{t.title}”
                          {savingParticipants ? ' — saving…' : ''}
                        </div>
                        {employees.length === 0 ? (
                          <div className="empty" style={{ padding: '6px 0' }}>
                            No employees found. Add users with the “employee” role first.
                          </div>
                        ) : (
                          <div className="checkbox-list">
                            {employees.map((emp) => (
                              <label key={emp.id} className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={assigned.has(emp.id)}
                                  disabled={savingParticipants}
                                  onChange={() => toggleAssignment(t.id, emp.id)}
                                />
                                <span>{emp.full_name}</span>
                                <span className="dept-tag">{emp.department || '—'}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="field-hint">
                          Ticking someone enrols them. They will then see any evaluation launched
                          for this training with “programme” scope.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {trainings.length === 0 && (
            <tr><td colSpan={7} className="empty">No trainings yet. Click “Register training”.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
