/**
 * src/lib/csv.ts
 * Safe CSV export: every field quoted, quotes doubled, and cells that start with = + - @ get a leading '
 * so a name like "=HYPERLINK(...)" can't run as a spreadsheet formula.
 */
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

export function downloadCsv(filename: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });   // BOM so Excel reads UTF-8 names
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
