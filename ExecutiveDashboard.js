'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

const EMPTY = { name: '', description: '' };

export default function WigManager({ profile, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [wigs, setWigs] = useState([]);
  const [counts, setCounts] = useState({}); // wig_id -> number of linked trainings

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function loadData() {
    const { data: w } = await supabase
      .from('wigs')
      .select('id, name, description')
      .order('name');
    setWigs(w || []);

    // How many trainings point at each WIG (so we can warn before deleting)
    const { data: tr } = await supabase.from('trainings').select('wig_id');
    const c = {};
    (tr || []).forEach((t) => {
      if (t.wig_id) c[t.wig_id] = (c[t.wig_id] || 0) + 1;
    });
    setCounts(c);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setMsg('');
    setFormOpen(true);
  }

  function startEdit(w) {
    setEditingId(w.id);
    setForm({ name: w.name || '', description: w.description || '' });
    setMsg('');
    setFormOpen(true);
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
    if (!form.name.trim()) {
      setMsg('A goal name is required.');
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('wigs').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('wigs').insert({ ...payload, created_by: profile.id }));
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

  async function handleDelete(w) {
    const linked = counts[w.id] || 0;

    if (linked > 0) {
      alert(
        `"${w.name}" cannot be deleted yet.\n\n` +
          `${linked} training${linked === 1 ? ' is' : 's are'} still linked to this goal. ` +
          `Re-assign or delete those trainings first, then try again.`
      );
      return;
    }

    const ok =
      typeof window !== 'undefined' &&
      window.confirm(`Delete the strategic goal "${w.name}"?\n\nThis cannot be undone.`);
    if (!ok) return;

    const { error } = await supabase.from('wigs').delete().eq('id', w.id);
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
        <h2>Strategic goals (WIGs)</h2>
        {formOpen ? (
          <button className="btn-small" onClick={closeForm}>Cancel</button>
        ) : (
          <button className="btn-small" onClick={openCreate}>+ Add goal</button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="inline-form">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            {editingId ? 'Edit goal' : 'New strategic goal'}
          </div>
          {msg ? <div className="login-error" style={{ marginBottom: 14 }}>{msg}</div> : null}
          <div className="form-grid">
            <div className="field field-wide">
              <label>Goal name</label>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Reduce Fraud & Underwriting Losses"
              />
            </div>
            <div className="field field-wide">
              <label>Description</label>
              <input
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="What does achieving this goal look like?"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 22px' }}
            disabled={saving}
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save goal'}
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Goal</th>
            <th>Description</th>
            <th style={{ textAlign: 'center' }}>Trainings</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {wigs.map((w) => (
            <tr key={w.id}>
              <td style={{ fontWeight: 600 }}>{pretty(w.name)}</td>
              <td style={{ color: 'var(--muted)' }}>{w.description || '—'}</td>
              <td style={{ textAlign: 'center' }}>
                <span className="count-chip">{counts[w.id] || 0}</span>
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="link-btn" onClick={() => startEdit(w)}>Edit</button>
                <button className="link-btn danger" onClick={() => handleDelete(w)}>Delete</button>
              </td>
            </tr>
          ))}
          {wigs.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">No strategic goals yet. Click “Add goal”.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
