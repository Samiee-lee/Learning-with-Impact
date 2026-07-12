'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

// Score → colour band (higher is always better; reverse questions were already inverted on save)
function band(v, max) {
  if (v === null || v === undefined) return '';
  const pct = max === 100 ? v : (v / 5) * 100;
  if (pct >= 75) return 'good';
  if (pct >= 55) return 'mid';
  return 'low';
}

function fmt(v) {
  return v === null || v === undefined ? '—' : v.toFixed(1);
}

export default function ReportsManager() {
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState({});
  const [rows, setRows] = useState([]);
  const [facilitators, setFacilitators] = useState([]);

  useEffect(() => {
    async function load() {
      const [evalsR, qsR, ansR, valR, respR, trR] = await Promise.all([
        supabase.from('evaluations').select('id, level, training_id'),
        supabase.from('evaluation_questions').select('id, evaluation_id'),
        supabase.from('response_answers').select('question_id, answer_numeric'),
        supabase.from('manager_validations').select('validated, response_id'),
        supabase.from('evaluation_responses').select('id, evaluation_id'),
        supabase.from('trainings').select('id, title, facilitator, facilitator_kind'),
      ]);

      const evalById = {};
      (evalsR.data || []).forEach((e) => (evalById[e.id] = e));
      const qToEval = {};
      (qsR.data || []).forEach((q) => (qToEval[q.id] = q.evaluation_id));
      const respToEval = {};
      (respR.data || []).forEach((r) => (respToEval[r.id] = r.evaluation_id));
      const trainingById = {};
      (trR.data || []).forEach((t) => (trainingById[t.id] = t));

      const levelAgg = { 1: { s: 0, n: 0 }, 2: { s: 0, n: 0 }, 4: { s: 0, n: 0 } };
      const perT = {};
      const ensureT = (id) => {
        if (!perT[id]) perT[id] = { 1: { s: 0, n: 0 }, 2: { s: 0, n: 0 }, 4: { s: 0, n: 0 }, 3: { v: 0, t: 0 } };
        return perT[id];
      };
      const facAgg = {};

      (ansR.data || []).forEach((a) => {
        if (a.answer_numeric === null || a.answer_numeric === undefined) return;
        const ev = evalById[qToEval[a.question_id]];
        if (!ev) return;
        const lvl = ev.level;
        if (lvl === 1 || lvl === 2 || lvl === 4) {
          levelAgg[lvl].s += Number(a.answer_numeric);
          levelAgg[lvl].n += 1;
          const t = ensureT(ev.training_id);
          t[lvl].s += Number(a.answer_numeric);
          t[lvl].n += 1;

          if (lvl === 1) {
            const tr = trainingById[ev.training_id];
            const fac = tr && tr.facilitator;
            if (fac) {
              if (!facAgg[fac]) facAgg[fac] = { s: 0, n: 0, kind: tr.facilitator_kind || 'individual', set: new Set() };
              facAgg[fac].s += Number(a.answer_numeric);
              facAgg[fac].n += 1;
              facAgg[fac].set.add(ev.training_id);
            }
          }
        }
      });

      let orgVal = { v: 0, t: 0 };
      (valR.data || []).forEach((v) => {
        const ev = evalById[respToEval[v.response_id]];
        if (!ev || ev.level !== 3) return;
        const t = ensureT(ev.training_id);
        t[3].t += 1;
        orgVal.t += 1;
        if (v.validated) {
          t[3].v += 1;
          orgVal.v += 1;
        }
      });

      const ls = {};
      [1, 2, 4].forEach((l) => {
        ls[l] = levelAgg[l].n ? { avg: levelAgg[l].s / levelAgg[l].n, n: levelAgg[l].n } : null;
      });
      ls[3] = orgVal.t ? { rate: Math.round((orgVal.v / orgVal.t) * 100), n: orgVal.t } : null;
      setLevels(ls);

      setRows(
        Object.entries(perT)
          .map(([id, m]) => ({
            title: trainingById[id]?.title || '—',
            l1: m[1].n ? m[1].s / m[1].n : null,
            l2: m[2].n ? m[2].s / m[2].n : null,
            l3: m[3].t ? Math.round((m[3].v / m[3].t) * 100) : null,
            l4: m[4].n ? m[4].s / m[4].n : null,
          }))
          .sort((a, b) => (a.title > b.title ? 1 : -1))
      );

      setFacilitators(
        Object.entries(facAgg)
          .map(([name, f]) => ({ name, kind: f.kind, avg: f.s / f.n, n: f.n, trainings: f.set.size }))
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 5)
      );

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="center-note">Building reports…</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Performance by evaluation level</h2>
        <div className="field-hint" style={{ marginBottom: 14 }}>
          Where in the Kirkpatrick chain programmes are strong or failing. Higher is always better.
        </div>
        <div className="level-cards">
          <div className={`level-card ${band(levels[1]?.avg, 5)}`}>
            <div className="lc-name">L1 · Reaction</div>
            <div className="lc-value">{levels[1] ? `${levels[1].avg.toFixed(1)}` : '—'}<span className="lc-unit">/5</span></div>
            <div className="lc-n">{levels[1] ? `${levels[1].n} answers` : 'no data'}</div>
          </div>
          <div className={`level-card ${band(levels[2]?.avg, 5)}`}>
            <div className="lc-name">L2 · Learning</div>
            <div className="lc-value">{levels[2] ? `${levels[2].avg.toFixed(1)}` : '—'}<span className="lc-unit">/5</span></div>
            <div className="lc-n">{levels[2] ? `${levels[2].n} answers` : 'no data'}</div>
          </div>
          <div className={`level-card ${band(levels[3]?.rate, 100)}`}>
            <div className="lc-name">L3 · Behaviour</div>
            <div className="lc-value">{levels[3] ? `${levels[3].rate}` : '—'}<span className="lc-unit">%</span></div>
            <div className="lc-n">{levels[3] ? `${levels[3].n} validated` : 'no data'}</div>
          </div>
          <div className={`level-card ${band(levels[4]?.avg, 5)}`}>
            <div className="lc-name">L4 · Results</div>
            <div className="lc-value">{levels[4] ? `${levels[4].avg.toFixed(1)}` : '—'}<span className="lc-unit">/5</span></div>
            <div className="lc-n">{levels[4] ? `${levels[4].n} answers` : 'no data'}</div>
          </div>
        </div>
        <div className="field-hint" style={{ marginTop: 12 }}>
          L1/L2/L4 are average scores out of 5. L3 is the share of reported behaviour changes a
          manager has validated. A blank means that level hasn’t been run yet.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Where each programme stands</h2>
        <table>
          <thead>
            <tr>
              <th>Training</th>
              <th style={{ textAlign: 'center' }}>L1</th>
              <th style={{ textAlign: 'center' }}>L2</th>
              <th style={{ textAlign: 'center' }}>L3 ✓%</th>
              <th style={{ textAlign: 'center' }}>L4</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.title}</td>
                <td style={{ textAlign: 'center' }}><span className={`score ${band(r.l1, 5)}`}>{fmt(r.l1)}</span></td>
                <td style={{ textAlign: 'center' }}><span className={`score ${band(r.l2, 5)}`}>{fmt(r.l2)}</span></td>
                <td style={{ textAlign: 'center' }}><span className={`score ${band(r.l3, 100)}`}>{r.l3 === null ? '—' : r.l3 + '%'}</span></td>
                <td style={{ textAlign: 'center' }}><span className={`score ${band(r.l4, 5)}`}>{fmt(r.l4)}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No evaluation data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Top facilitators & institutions</h2>
        <div className="field-hint" style={{ marginBottom: 12 }}>
          Ranked by average Level 1 reaction score across their trainings.
        </div>
        {facilitators.length === 0 ? (
          <div className="empty">No facilitator data yet — add facilitator names to trainings and run Level 1.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Facilitator / institution</th>
                <th style={{ textAlign: 'center' }}>Avg L1</th>
                <th style={{ textAlign: 'center' }}>Trainings</th>
                <th style={{ textAlign: 'center' }}>Responses</th>
              </tr>
            </thead>
            <tbody>
              {facilitators.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{i + 1}</td>
                  <td>
                    {f.name}
                    <span className="kind-tag">{f.kind}</span>
                    {f.n < 3 ? <span className="kind-tag warn">limited data</span> : null}
                  </td>
                  <td style={{ textAlign: 'center' }}><span className={`score ${band(f.avg, 5)}`}>{f.avg.toFixed(1)}</span></td>
                  <td style={{ textAlign: 'center' }}>{f.trainings}</td>
                  <td style={{ textAlign: 'center' }}>{f.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
