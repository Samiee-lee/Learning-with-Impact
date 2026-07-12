'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { downloadCSV } from '../lib/exporters';

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADERS = ['Email', 'Training'];
const norm = (s) => (s || '').trim();

export default function BulkAssignParticipants({ onDone, onClose }) {
  const [profilesByEmail, setProfilesByEmail] = useState({});
  const [trainingsByTitle, setTrainingsByTitle] = useState({});
  const [existing, setExisting] = useState(new Set()); // "trainingId|employeeId"
  const [loaded, setLoaded] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    async function load() {
      const [{ data: profs }, { data: trs }, { data: asg }] = await Promise.all([
        supabase.from('profiles').select('id, email'),
        supabase.from('trainings').select('id, title'),
        supabase.from('training_assignments').select('training_id, employee_id'),
      ]);
      const pByEmail = {};
      (profs || []).forEach((p) => {
        if (p.email) pByEmail[p.email.trim().toLowerCase()] = p;
      });
      const tByTitle = {};
      (trs || []).forEach((t) => {
        if (t.title) tByTitle[t.title.trim().toLowerCase()] = t;
      });
      const ex = new Set();
      (asg || []).forEach((a) => ex.add(`${a.training_id}|${a.employee_id}`));
      setProfilesByEmail(pByEmail);
      setTrainingsByTitle(tByTitle);
      setExisting(ex);
      setLoaded(true);
    }
    load();
  }, []);

  function template() {
    downloadCSV('participants-template.csv', [
      HEADERS,
      ['toluwani@evolution.test', 'Underwriting Excellence'],
      ['bidemi@evolution.test', 'Underwriting Excellence'],
    ]);
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setMsg('');
    setDone(null);
    setParsed(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => processText(String(reader.result));
    reader.onerror = () => setMsg('Could not read that file.');
    reader.readAsText(file);
  }

  function processText(text) {
    const rows = parseCSV(text).filter((r) => r.some((c) => norm(c) !== ''));
    if (rows.length < 2) {
      setMsg('That file has a header but no data rows.');
      return;
    }
    const header = rows[0].map((h) => norm(h).toLowerCase());
    const iEmail = header.indexOf('email');
    const iTraining = header.indexOf('training');
    if (iEmail < 0 || iTraining < 0) {
      setMsg('Need both an "Email" and a "Training" column. Download the template for the exact headers.');
      return;
    }

    const valid = [];
    const problems = [];
    const seen = new Set(); // dedupe within the file

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const email = norm(row[iEmail]).toLowerCase();
      const title = norm(row[iTraining]);
      const errs = [];

      const prof = email ? profilesByEmail[email] : null;
      const tr = title ? trainingsByTitle[title.toLowerCase()] : null;

      if (!email) errs.push('missing email');
      else if (!prof) errs.push(`no account for ${email}`);
      if (!title) errs.push('missing training');
      else if (!tr) errs.push(`training "${title}" not found`);

      if (prof && tr) {
        const key = `${tr.id}|${prof.id}`;
        if (existing.has(key)) errs.push('already assigned');
        else if (seen.has(key)) errs.push('duplicate row in file');
        else {
          seen.add(key);
          valid.push({ training_id: tr.id, employee_id: prof.id, _email: email, _title: title });
        }
      }

      if (errs.length) problems.push({ line: r + 1, email: email || '(none)', title: title || '(none)', errs });
    }

    setParsed({ valid, problems });
    if (valid.length === 0) setMsg('No rows are ready to assign — see the problems below.');
  }

  async function doImport() {
    if (!parsed || parsed.valid.length === 0) return;
    setImporting(true);
    setMsg('');
    const payload = parsed.valid.map((v) => ({ training_id: v.training_id, employee_id: v.employee_id }));
    const { error } = await supabase.from('training_assignments').insert(payload);
    setImporting(false);
    if (error) {
      setMsg('Assignment failed: ' + error.message);
      return;
    }
    setDone(parsed.valid.length);
    setParsed(null);
    setFileName('');
    if (onDone) onDone();
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Bulk assign participants</h2>
        <button className="btn-small" onClick={onClose}>Close</button>
      </div>

      {!loaded ? (
        <div className="center-note">Loading accounts and trainings…</div>
      ) : (
        <>
          {done !== null ? (
            <div className="ai-summary" style={{ marginBottom: 16 }}>
              <span className="tag">Done</span>
              <div>{done} assignment{done === 1 ? '' : 's'} created. Participants will see these trainings on their dashboard.</div>
            </div>
          ) : null}

          <ol className="steps">
            <li>
              Download the template.{' '}
              <button className="link-btn" onClick={template}>⬇ Download template CSV</button>
            </li>
            <li>
              Two columns: <strong>Email, Training</strong>. One row per person-per-training.
              The same person can appear on several rows for several trainings.
            </li>
            <li>
              Each <strong>email</strong> must belong to an existing account, and each
              <strong> Training</strong> title must match exactly. Anything unmatched is flagged and skipped.
            </li>
            <li>People already assigned, or duplicate rows, are skipped automatically.</li>
          </ol>

          <div className="upload-row">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
            {fileName ? <span className="field-hint">{fileName}</span> : null}
          </div>

          {msg ? <div className="login-error" style={{ marginTop: 14 }}>{msg}</div> : null}

          {parsed ? (
            <div style={{ marginTop: 18 }}>
              <div className="preview-summary">
                <span className="score good">{parsed.valid.length} ready</span>
                {parsed.problems.length > 0 ? <span className="score low">{parsed.problems.length} skipped</span> : null}
              </div>

              {parsed.problems.length > 0 && (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Row</th>
                      <th>Email</th>
                      <th>Training</th>
                      <th>Reason skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.problems.map((p, i) => (
                      <tr key={i}>
                        <td>{p.line}</td>
                        <td>{p.email}</td>
                        <td>{p.title}</td>
                        <td style={{ color: '#b42318' }}>{p.errs.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '10px 22px', marginTop: 16 }}
                onClick={doImport}
                disabled={importing || parsed.valid.length === 0}
              >
                {importing ? 'Assigning…' : `Assign ${parsed.valid.length} participant${parsed.valid.length === 1 ? '' : 's'}`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
