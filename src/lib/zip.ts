// ============================================================
// zip.ts — Photo ZIP export using jszip (lazy-loaded)
// ============================================================

export interface PhotoEntry {
  filename: string;
  url: string;
}

/** Downloads photos concurrently (max 4) and packages them into a ZIP. */
export async function downloadPhotoZip(
  entries: PhotoEntry[],
  zipFilename: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ skipped: number }> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const concurrency = 4;
  let done = 0;
  let skipped = 0;

  async function processEntry(entry: PhotoEntry): Promise<void> {
    try {
      const res = await fetch(entry.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      zip.file(entry.filename, blob);
    } catch {
      skipped++;
    } finally {
      done++;
      onProgress?.(done, entries.length);
    }
  }

  // Process in batches of `concurrency`
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    await Promise.all(batch.map(processEntry));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  a.click();
  URL.revokeObjectURL(url);

  return { skipped };
}

/** Sanitise a filename component: replace unsafe chars with _  */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim();
}
