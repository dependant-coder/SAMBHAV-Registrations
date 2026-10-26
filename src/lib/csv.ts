// ============================================================
// csv.ts — CSV export with UTF-8 BOM and formula injection neutralisation
// ============================================================

/** Neutralise formula injection per spec §10.2 */
function sanitizeCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  // Prefix with ' if the cell starts with =, +, -, @, tab, or CR
  if (s && ['=', '+', '-', '@', '\t', '\r'].includes(s[0])) {
    return "'" + s;
  }
  return s;
}

function escapeCell(value: unknown): string {
  const safe = sanitizeCell(value == null ? '' : String(value));
  // Wrap in quotes if contains comma, newline or quote
  if (safe.includes(',') || safe.includes('\n') || safe.includes('"')) {
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  return safe;
}

export function buildCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const BOM = '\uFEFF';
  const header = columns.join(',');
  const body = rows
    .map(row =>
      columns.map(col => escapeCell(String(row[col] ?? ''))).join(',')
    )
    .join('\n');
  return BOM + header + '\n' + body;
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');

export function downloadCsv(filename: string, text: string) {
  downloadCSV(text, filename);
}

