'use client';

// Turn a matrix (array of row-arrays) into a downloadable CSV that opens cleanly in Excel.
export function downloadCSV(filename, matrix) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const body = matrix.map((row) => row.map(esc).join(',')).join('\n');
  const csv = '\ufeff' + body; // BOM so Excel reads UTF-8 correctly
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printView() {
  if (typeof window !== 'undefined') window.print();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
