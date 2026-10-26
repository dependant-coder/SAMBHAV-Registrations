/**
 * src/lib/ics.ts
 * "Add to calendar": builds an .ics file in the browser and downloads it.
 */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 says lines over 75 octets should be folded. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(e: {
  id: string; title: string; description?: string | null; venue?: string | null;
  starts_at: string; ends_at?: string | null;
}) {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sambhav 4.0//Members//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@sambhav`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.venue ? `LOCATION:${esc(e.venue)}` : '',
    e.description ? `DESCRIPTION:${esc(e.description)}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(fold);
  return lines.join('\r\n');
}

export function downloadIcs(e: Parameters<typeof buildIcs>[0]) {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${e.title.replace(/[^\w]+/g, '-').slice(0, 40) || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
