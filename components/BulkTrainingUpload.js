'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { downloadCSV } from '../lib/exporters';

// Minimal CSV parser: handles quoted fields, escaped quotes, and CRLF.
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

const HEADERS = ['Title', 'Objective', 'Type', 'Delivery mode', 'Facilitator', 'WIG', 'Audience'];
const norm = (s) => (s || '').trim();

export default function BulkTrainingUpload({ onDone, onClose }) {
  const [wigs, setWigs] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    supabase
      .from('wigs')
      .select('id, name')
      .then(({ data }) => setWigs(data || []));
  }, []);

  function template() {
    downloadCSV('trainings-template.csv', [
      HEADERS,
      ['Underwriting Excellence', 'Improve loan quality decisions', 'internal', 'physical', 'Dolapo Fasuyi', 'Reduce default rate', 'Credit officers'],
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
    const idx = (name) => header.indexOf(name);
    const iTitle = idx('title');
    const iObj = idx('objective');
    const iType = idx('type');
    const iMode = idx('delivery mode');
    const iFac = idx('facilitator');
    const iWig = idx('wig');
    const iAud = idx('audience');

    if (iTitle < 0) {
      setMsg('No "Title" column found. Download the template for the exact headers.');
      return;
    }

    const wigByName = {};
    wigs.forEach((w) => (wigByName[(w.name || '').trim().toLowerCase()] = w));

    const valid = [];
    const problems = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const title = norm(row[iTitle]);
      const typeRaw = norm(iType >= 0 ? row[iType] : '').toLowerCase();
      const modeRaw = norm(iMode >= 0 ? row[iMode] : '').toLowerCase();
      const wigName = norm(iWig >= 0 ? row[iWig] : '');
      const fac = norm(iFac >= 0 ? row[iFac] : '');
      const errs = [];

      if (!title) errs.push('missing title');

      let type = 'internal';
      if (typeRaw) {
        if (typeRaw === 'internal' || typeRaw === 'external') type = typeRaw;
        else errs.push(`type "${typeRaw}" is not internal/external`);
      }

      let mode = 'physical';
      if (modeRaw) {
        if (['physical', 'virtual', 'blended'].includes(modeRaw)) mode = modeRaw;
        else errs.push(`delivery "${modeRaw}" is not physical/virtual/blended`);
      }

      let wig_id = null;
      if (wigName) {
        const w = wigByName[wigName.toLowerCase()];
        if (w) wig_id = w.id;
        else errs.push(`WIG "${wigName}" doesn't exist — create it first`);
      }

      const rec = {
        title,
        one_line_objective: norm(iObj >= 0 ? row[iObj] : '') || null,
        training_type: type,
        delivery_mode: mode,
        facilitator: fac || null,
        facilitator_kind: fac ? 'individual' : null,
        wig_id,
        target_audience: norm(iAud >= 0 ? row[iAud] : '') || null,
        status: 'draft',
      };

      if (errs.length) problems.push({ line: r + 1, title: title || '(no title)', errs });
      else valid.push(rec);
    }

    setParsed({ valid, problems });
    if (valid.length === 0) setMsg('No rows are ready to import — see the problems below.');
  }

  async function doImport() {
    if (!parsed || parsed.valid.length === 0) return;
    setImporting(true);
    setMsg('');
    const { error } = await supabase.from('trainings').insert(parsed.valid);
    setImporting(false);
    if (error) {
      setMsg('Import failed: ' + error.message);
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
        <h2>Bulk upload trainings</h2>
        <button className="btn-small" onClick={onClose}>Close</button>
      </div>

      {done !== null ? (
        <div className="ai-summary" style={{ marginBottom: 16 }}>
          <span className="tag">Done</span>
          <div>{done} training{done === 1 ? '' : 's'} imported as drafts. Find them in the list below to review, assign participants, and activate.</div>
        </div>
      ) : null}

      <ol className="steps">
        <li>
          Download the template, fill one row per training.{' '}
          <button className="link-btn" onClick={template}>⬇ Download template CSV</button>
        </li>
        <li>
          Columns: <strong>Title, Objective, Type, Delivery mode, Facilitator, WIG, Audience</strong>.
          Only Title is required. Type = internal/external. Delivery = physical/virtual/blended.
        </li>
        <li>
          The <strong>WIG</strong> must already exist (exact name). Rows naming an unknown WIG are
          flagged and skipped, so a typo can't create a stray goal.
        </li>
        <li>Upload the file, review the preview, then confirm.</li>
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
            {parsed.problems.length > 0 ? <span className="score low">{parsed.problems.length} with problems</span> : null}
          </div>

          {parsed.problems.length > 0 && (
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Row</th>
                  <th>Title</th>
                  <th>Problem — this row will be skipped</th>
                </tr>
              </thead>
              <tbody>
                {parsed.problems.map((p, i) => (
                  <tr key={i}>
                    <td>{p.line}</td>
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
            {importing ? 'Importing…' : `Import ${parsed.valid.length} training${parsed.valid.length === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
