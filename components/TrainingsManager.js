'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

const EMPTY = { title: '', objective: '', ttype: 'internal', wigId: '', audience: '', status: 'draft' };

export default function TrainingsManager({ profile, onChanged, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState([]);
  const [wigs, setWigs] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(EMPTY);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function loadData() {
    const { data: tr } = await supabase
      .from('trainings')
      .select('id, title, one_line_objective, training_type, status, target_audience, wig_id, wigs(name)')
      .order('created_at', { ascending: true });
    setTrainings(tr || []);

    const { data: w } = await supabase.from('wigs').select('id, name').order('name');
    setWigs(w || []);

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
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 22px' }} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save training'}
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr><th>Title</th><th>Type</th><th>WIG</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
        </thead>
        <tbody>
          {trainings.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td style={{ textTransform: 'capitalize' }}>{t.training_type}</td>
              <td>{pretty(t.wigs?.name)}</td>
              <td><span className={`pill ${t.status}`}>{t.status}</span></td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="link-btn" onClick={() => startEdit(t)}>Edit</button>
                <button className="link-btn danger" onClick={() => handleDelete(t)}>Delete</button>
              </td>
            </tr>
          ))}
          {trainings.length === 0 && (
            <tr><td colSpan={5} className="empty">No trainings yet. Click “Register training”.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
