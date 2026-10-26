/**
 * src/hooks/useQr.ts
 * Makes a QR code locally (works offline) as a data URL for an <img>.
 * Black on white with a quiet zone and error-correction M so any camera reads it.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function useQr(text: string | null | undefined, width = 480) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!text) { setUrl(null); return; }
    QRCode.toDataURL(text, { margin: 2, errorCorrectionLevel: 'M', width, color: { dark: '#000000', light: '#FFFFFF' } })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [text, width]);
  return url;
}
