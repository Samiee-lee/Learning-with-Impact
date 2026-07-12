'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EMPTY = { name: '', unit: '%', direction: 'increase', baseline: '', target: '', current: '' };

// Attainment 0..1+ (how far current has moved from baseline toward target)
export function attainment(k) {
  const b = Number(k.baseline);
  const t = Number(k.target);
  const c = Number(k.current);
  if ([b, t, c].some((x) => Number.isNaN(x))) return null;
  const span = k.direction === 'increase' ? t - b : b - t;
  if (span === 0) return null;
  const moved = k.direction === 'increase' ? c - b : b - c;
  return moved / span;
}

function statusOf(a) {
  if (a === null) return { label: 'incomplete', cls: '' };
  if (a >= 1) return { label: 'target met', cls: 'good' };
  if (a >= 0.6) return { label: 'on track', cls: 'mid' };
  if (a >= 0) return { label: 'behind', cls: 'low' };
  return { label: 'regressed', cls: 'low' };
}

export default function KpiManager({ wigId, profileId, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function load() {
    const { data } = await supabase
      .from('wig_kpis')
      .select('id, name, unit, direction, baseline, target, current, notes')
      .eq('wig_id', wigId)
      .order('created_at');
    setKpis(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [wigId]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setMsg('');
    setFormOpen(true);
  }
  function startEdit(k) {
    setEditingId(k.id);
    setForm({
      name: k.name || '',
      unit: k.unit || '',
      direction: k.direction || 'increase',
      baseline: k.baseline ?? '',
      target: k.target ?? '',
      current: k.current ?? '',
    });
    setMsg('');
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    setMsg('');
  }

  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg('');
    if (!form.name.trim()) {
      setMsg('KPI name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      wig_id: wigId,
      name: form.name.trim(),
      unit: form.unit.trim(),
      direction: form.direction,
      baseline: num(form.baseline),
      target: num(form.target),
      current: num(form.current),
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('wig_kpis').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('wig_kpis').insert({ ...payload, created_by: profileId }));
    }
    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return;
    }
    closeForm();
    await load();
    if (onChanged) onChanged();
  }

  async function handleDelete(k) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete KPI "${k.name}"?`)) return;
    const { error } = await supabase.from('wig_kpis').delete().eq('id', k.id);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    await load();
    if (onChanged) onChanged();
  }

  if (loading) return <div className="empty" style={{ padding: '8px 0' }}>Loading KPIs…</div>;

  return (
    <div>
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div className="detail-title" style={{ marginBottom: 0 }}>Key performance indicators</div>
        {formOpen ? (
          <button className="btn-small" onClick={closeForm}>Cancel</button>
        ) : (
          <button className="btn-small" onClick={openCreate}>+ Add KPI</button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="inline-form">
          {msg ? <div className="login-error" style={{ marginBottom: 12 }}>{msg}</div> : null}
          <div className="form-grid">
            <div className="field field-wide">
              <label>KPI name</label>
              <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Fraud detection rate" />
            </div>
            <div className="field">
              <label>Unit</label>
              <input value={form.unit} onChange={(e) => setField('unit', e.target.value)} placeholder="% , N bn, days…" />
            </div>
            <div className="field">
              <label>Better when</label>
              <select value={form.direction} onChange={(e) => setField('direction', e.target.value)}>
                <option value="increase">Higher is better</option>
                <option value="decrease">Lower is better</option>
              </select>
            </div>
            <div className="field">
              <label>Baseline</label>
              <input type="number" step="any" value={form.baseline} onChange={(e) => setField('baseline', e.target.value)} placeholder="before" />
            </div>
            <div className="field">
              <label>Target</label>
              <input type="number" step="any" value={form.target} onChange={(e) => setField('target', e.target.value)} placeholder="goal" />
            </div>
            <div className="field">
              <label>Current</label>
              <input type="number" step="any" value={form.current} onChange={(e) => setField('current', e.target.value)} placeholder="latest actual" />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 22px' }} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save KPI'}
          </button>
        </form>
      )}

      {kpis.length === 0 ? (
        <div className="empty" style={{ padding: '10px 0' }}>No KPIs yet for this goal.</div>
      ) : (
        kpis.map((k) => {
          const a = attainment(k);
          const st = statusOf(a);
          const pct = a === null ? 0 : Math.max(0, Math.min(100, a * 100));
          return (
            <div key={k.id} className="kpi-row">
              <div className="kpi-top">
                <div className="kpi-name">
                  {k.name}
                  <span className="kpi-dir">{k.direction === 'increase' ? '↑ better' : '↓ better'}</span>
                </div>
                <div>
                  <span className={`score ${st.cls}`}>{st.label}</span>
                  <button className="link-btn" onClick={() => startEdit(k)}>Edit</button>
                  <button className="link-btn danger" onClick={() => handleDelete(k)}>Delete</button>
                </div>
              </div>
              <div className="kpi-figures">
                <span>Baseline <strong>{k.baseline ?? '—'}{k.unit}</strong></span>
                <span>Current <strong>{k.current ?? '—'}{k.unit}</strong></span>
                <span>Target <strong>{k.target ?? '—'}{k.unit}</strong></span>
                {a !== null && <span className="kpi-att">{Math.round(a * 100)}% of the way</span>}
              </div>
              <div className="bar-track" style={{ marginTop: 6 }}>
                <div className={`bar-fill ${st.cls}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
