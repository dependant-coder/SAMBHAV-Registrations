/**
 * src/components/member/ui.tsx
 * Small building blocks shared by every members-app screen.
 * Markup and class names match the riso mockup 1:1 (styles live in src/styles/member.css).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { initialsOf } from '../../lib/format';

/* ------------------------------------------------------------------ */
/* Icons: one hidden sprite, rendered once by AppShell / public pages   */
/* ------------------------------------------------------------------ */
export type IconName =
  | 'home' | 'bell' | 'mega' | 'cal' | 'user' | 'shield' | 'id' | 'scan' | 'check' | 'x' | 'chev' | 'back'
  | 'copy' | 'share' | 'sun' | 'pin' | 'clock' | 'chat' | 'lock' | 'out' | 'flash' | 'dl' | 'search'
  | 'users' | 'plus' | 'eye' | 'pinned' | 'alert' | 'phone' | 'qr';

export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
        <symbol id="i-mega" viewBox="0 0 24 24"><path d="M4 10v4l12 5V5z" /><path d="M4 10h3v4H4z" /><path d="M19 9a4 4 0 0 1 0 6" /></symbol>
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></symbol>
        <symbol id="i-id" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M15 10h3M15 13h3" /></symbol>
        <symbol id="i-scan" viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7" /></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></symbol>
        <symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></symbol>
        <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 6 9 12l6 6" /></symbol>
        <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></symbol>
        <symbol id="i-share" viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
        <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.7z" /></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></symbol>
        <symbol id="i-out" viewBox="0 0 24 24"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" /></symbol>
        <symbol id="i-flash" viewBox="0 0 24 24"><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></symbol>
        <symbol id="i-dl" viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.5 2.2 3.5 5.5" /></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></symbol>
        <symbol id="i-pinned" viewBox="0 0 24 24"><path d="m15 3 6 6-3 1-4 4 .5 4.5L12 17l-3 4-1-1 4-3-2.5-2.5L5.5 14 11 9l1-3z" /></symbol>
        <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17.2v.1" /></symbol>
        <symbol id="i-phone" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M11 18.5h2" /></symbol>
        <symbol id="i-qr" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v.1M14 20h3M20 17v4" /></symbol>
        {/* Venn logo: colours come from CSS variables because class selectors don't reach into <use> */}
        <symbol id="venn" viewBox="0 0 32 32">
          <circle cx="12" cy="16" r="10" style={{ fill: 'var(--va,#2B34F0)' }} />
          <circle cx="20" cy="16" r="10" style={{ fill: 'var(--vb,#FFB81C)', mixBlendMode: 'var(--vbm,multiply)' as never }} />
        </symbol>
      </defs>
    </svg>
  );
}

export function Ic({ n, className, style }: { n: IconName; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`ic${className ? ' ' + className : ''}`} style={style} aria-hidden="true" focusable="false">
      <use href={`#i-${n}`} />
    </svg>
  );
}

export function Brand({ to = '/app', label = 'Sambhav 4.0' }: { to?: string; label?: string }) {
  return (
    <a className="brand" href={to}>
      <svg viewBox="0 0 32 32" aria-hidden="true"><use href="#venn" /></svg>
      {label}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Header band                                                          */
/* ------------------------------------------------------------------ */
export type Tone = 'blue' | 'sun' | 'mint' | 'ink' | 'pink';

export function Band({
  tone, tall, pb, eyebrow, title, titleStyle, sub, right, children, brandTo,
}: {
  tone: Tone; tall?: boolean; pb?: number; eyebrow?: ReactNode; title?: ReactNode;
  titleStyle?: React.CSSProperties; sub?: ReactNode; right?: ReactNode; children?: ReactNode; brandTo?: string;
}) {
  return (
    <div className={`band${tall ? ' band--tall' : ''}`} data-tone={tone} style={pb != null ? { paddingBottom: pb } : undefined}>
      <i className="bd bd--a" /><i className="bd bd--b" />
      <div className="band__top">
        <Brand to={brandTo} />
        {right}
      </div>
      {eyebrow != null && <p className="band__eyebrow">{eyebrow}</p>}
      {title != null && <h1 className="band__title" style={titleStyle}>{title}</h1>}
      {sub != null && <p className="band__sub">{sub}</p>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */
export function Chip({ tone, small, children }: { tone?: 'blue' | 'sun' | 'mint' | 'pink' | 'ink' | 'deep' | 'white'; small?: boolean; children: ReactNode }) {
  return (
    <span className={`chip${tone ? ` chip--${tone}` : ''}`} style={small ? { minHeight: 24, fontSize: 12 } : undefined}>
      {children}
    </span>
  );
}

export function Spinner() { return <span className="spin" role="status" aria-label="Loading" />; }

export function Splash({ label }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
        <svg viewBox="0 0 32 32" width="56" height="56" aria-hidden="true" style={{ ['--va' as never]: 'var(--blue)', ['--vb' as never]: 'var(--sun)', ['--vbm' as never]: 'multiply' } as React.CSSProperties}>
          <use href="#venn" />
        </svg>
        <span className="small muted">{label ?? 'Loading…'}</span>
      </div>
    </div>
  );
}

export function Banner({ tone, children }: { tone?: 'off' | 'err' | 'warn'; children: ReactNode }) {
  return (
    <div className={`banner${tone ? ` banner--${tone}` : ''}`} role={tone === 'err' ? 'alert' : 'status'}>
      <span className="banner__dot" />
      <span>{children}</span>
    </div>
  );
}

export function Note({ tone, icon, children, style }: { tone?: 'warn' | 'err' | 'ok'; icon?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={`note${tone ? ` note--${tone}` : ''}`} style={style}>
      <span className="note__ic">{icon ?? (tone ? '!' : 'i')}</span>
      <span>{children}</span>
    </div>
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  return <p className="err" role="alert"><Ic n="alert" />{children}</p>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
      <p className="h3">{title}</p>
      {text && <p className="small muted" style={{ marginTop: 6 }}>{text}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div className="skel" key={i} />)}
    </div>
  );
}

export function LoadError({ onRetry, text }: { onRetry: () => void; text?: string }) {
  return (
    <Note tone="err">
      {text ?? "Couldn't load this."} <button className="linkbtn" onClick={onRetry}>Retry</button>
    </Note>
  );
}

export function BackBar({ to, label, onBack }: { to?: string; label: string; onBack?: () => void }) {
  const nav = useNavigate();
  return (
    <div className="topnav">
      <button className="back" onClick={onBack ?? (() => nav(to ?? '/app'))}>
        <Ic n="back" />{label}
      </button>
    </div>
  );
}

export function Btn(
  { tone = 'ink', size, block, loading, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'ink' | 'blue' | 'sun' | 'line' | 'white' | 'mint'; size?: 'sm'; block?: boolean; loading?: boolean },
) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`btn btn--${tone}${size ? ' btn--sm' : ''}${block ? ' btn--block' : ''}${rest.className ? ' ' + rest.className : ''}`}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar: signed URL for the private photo bucket, initials fallback   */
/* ------------------------------------------------------------------ */
const urlCache = new Map<string, { url: string; exp: number }>();

export function usePhotoUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    const hit = urlCache.get(path);
    if (hit && hit.exp > Date.now()) { setUrl(hit.url); return; }
    supabase.storage.from('member-photos').createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive || !data?.signedUrl) return;
      urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path]);
  return url;
}

export function Avatar({
  name, path, size, className = 'avatar', style, as: Tag = 'span',
}: { name: string; path?: string | null; size?: number; className?: string; style?: React.CSSProperties; as?: 'span' | 'div' }) {
  const url = usePhotoUrl(path);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const s = size ? { width: size, height: size, ...style } : style;
  return (
    <Tag className={className} style={s}>
      {url && !failed
        ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <span className="initials" aria-hidden="true" style={{ fontSize: size ? Math.round(size * 0.38) : undefined }}>{initialsOf(name)}</span>}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Portal: .mapp-root WITHOUT .mapp, so position:fixed works            */
/* ------------------------------------------------------------------ */
export function FixedPortal({ children }: { children: ReactNode }) {
  const [el] = useState(() => {
    const d = document.createElement('div');
    d.className = 'mapp-root';
    return d;
  });
  useEffect(() => {
    document.body.appendChild(el);
    return () => { el.remove(); };
  }, [el]);
  return createPortal(children, el);
}

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */
type ToastFn = (msg: string) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  const show = useCallback<ToastFn>((m) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg && <FixedPortal><div className="toast is-on" role="status">{msg}</div></FixedPortal>}
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Online status                                                        */
/* ------------------------------------------------------------------ */
export function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export function OfflineBar() {
  const on = useOnline();
  if (on) return null;
  return (
    <div className="banners">
      <Banner tone="off"><strong>You're offline.</strong> Showing the last saved data. Check-in and saving need internet.</Banner>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Six-box code / PIN input (one real <input> behind visual cells)       */
/* ------------------------------------------------------------------ */
export function CellsInput({
  value, onChange, length = 6, mode = 'numeric', masked, error, label, autoFocus, codeStyle, onEnter, id,
}: {
  value: string; onChange: (v: string) => void; length?: number; mode?: 'numeric' | 'code';
  masked?: boolean; error?: boolean; label: string; autoFocus?: boolean; codeStyle?: boolean;
  onEnter?: () => void; id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(false);
  const clean = (v: string) =>
    mode === 'numeric' ? v.replace(/\D/g, '').slice(0, length) : v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, length);
  return (
    <div
      className={`cells${error ? ' cells--err' : ''}${codeStyle ? ' cells--code' : ''}`}
      style={{ position: 'relative' }}
      onClick={() => ref.current?.focus()}
    >
      {Array.from({ length }).map((_, i) => {
        const ch = value[i];
        const on = focus && i === Math.min(value.length, length - 1);
        return <div key={i} className={`cell${on ? ' cell--on' : ''}`} aria-hidden="true">{ch ? (masked ? '•' : ch) : ''}</div>;
      })}
      <input
        ref={ref}
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(clean(e.target.value))}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
        inputMode={mode === 'numeric' ? 'numeric' : 'text'}
        autoComplete={masked ? 'new-password' : 'off'}
        autoCapitalize={mode === 'code' ? 'characters' : 'off'}
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={length}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', fontSize: 16 }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AppFrame: the 430px app column + sprite + toast + body background    */
/* Use ONCE per page (it owns the icon sprite).                         */
/* ------------------------------------------------------------------ */
export function AppFrame({ children, dark }: { children: ReactNode; dark?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = dark ? '#14123A' : '#DDE0F2';
    return () => { document.body.style.background = prev; };
  }, [dark]);
  return (
    <ToastProvider>
      <div className={`mapp-root mapp${dark ? ' is-dark' : ''}`}>
        <Sprite />
        {children}
      </div>
    </ToastProvider>
  );
}

/* ------------------------------------------------------------------ */
/* "Need a hand?" footer + creator credit                               */
/* ------------------------------------------------------------------ */
export function MemberFoot({ credit = true, title = 'Need a hand?', text = 'Message the core team and we\'ll sort it out.' }: { credit?: boolean; title?: string; text?: string }) {
  const wa = ((import.meta.env.VITE_HELP_WHATSAPP as string | undefined) ?? '').replace(/\D/g, '');
  const href = wa ? `https://wa.me/${wa.length === 10 ? '91' + wa : wa}` : undefined;
  return (
    <div className="foot">
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <a className="btn btn--sun btn--sm" href={href} target="_blank" rel="noopener noreferrer">
          <Ic n="chat" />Message on WhatsApp
        </a>
      )}
      {credit && <p className="credit">Built with ♥ by <a href="/creator">{(import.meta.env.VITE_CREDIT_NAME as string | undefined) || 'Vedant Darange'}</a></p>}
    </div>
  );
}
