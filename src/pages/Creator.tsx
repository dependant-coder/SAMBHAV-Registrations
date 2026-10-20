import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────
   EDIT THIS BLOCK ONLY. Everything on the page reads from here.
   ───────────────────────────────────────────────────────────── */
const CREATOR = {
  name: 'Vedant Darange',
  photo: '/creator.jpg', // put your photo at public/creator.jpg (portrait, ~800x1000)
  roles: ['Full-stack developer', 'Designer of weird things', 'Sambhav 4.0 builder', 'Coffee-powered human'],
  tagline: 'I built this site so you could register in two minutes instead of two hours.',
  bio: [
    'Hi! I am a student who likes turning messy problems into clean little products. Sambhav 4.0 needed a registration system, so I built one from scratch.',
  ],
  email: 'vedantdarange2327@gmail.com',
  instagram: 'https://www.instagram.com/_being_vedant_23/',
  instagramHandle: '@_being_vedant_23',
  linkedin: 'https://www.linkedin.com/in/your-handle',
  linkedinHandle: 'in/Vedant Darange',
  github: 'https://github.com/your-handle', // set to '' to hide the card
  githubHandle: '@dependeant-coder',
  stats: [
    { n: 1, suffix: '', label: 'Fest powered' },
    { n: 500, suffix: '+', label: 'People (will) register (probably)' },
    { n: 40, suffix: '+', label: 'Hours of building' },
    { n: 100, suffix: '%', label: 'Made for SAMBHAV' },
  ],
  stack: ['React', 'TypeScript', 'Tailwind', 'Supabase', 'Vite', 'Vercel', 'PostgreSQL', 'Zod'],
  thanks: 'Thank you to the Sambhav team, to everyone who tested it, and to you for registering.',
};
/* ───────────────────────────────────────────────────────────── */

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Types a rotating list of words */
function Typer({ words }: { words: string[] }) {
  const [text, setText] = useState(words[0] ?? '');
  useEffect(() => {
    if (prefersReduced() || words.length === 0) return;
    let w = 0;
    let c = 0;
    let del = false;
    let id = 0;
    const tick = () => {
      const word = words[w];
      c += del ? -1 : 1;
      setText(word.slice(0, c));
      let d = del ? 30 : 65;
      if (!del && c === word.length) {
        del = true;
        d = 1500;
      } else if (del && c === 0) {
        del = false;
        w = (w + 1) % words.length;
        d = 300;
      }
      id = window.setTimeout(tick, d);
    };
    id = window.setTimeout(tick, 900);
    return () => window.clearTimeout(id);
  }, [words]);
  return (
    <span className="mc-typer">
      {text}
      <i className="mc-caret" aria-hidden="true" />
    </span>
  );
}

/* Counts up when scrolled into view */
function Count({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(prefersReduced() ? to : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const run = (t: number) => {
          const p = Math.min(1, (t - t0) / 1400);
          setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref}>
      {v}
      {suffix}
    </span>
  );
}

/* Brand icons inline so we don't depend on icon-pack versions */
const Icon = {
  insta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75ZM9.5 9.75h3.8v1.54h.05c.53-1 1.82-2.04 3.75-2.04 4 0 4.75 2.63 4.75 6.05V21h-4v-4.9c0-1.17-.02-2.67-1.63-2.67-1.63 0-1.88 1.27-1.88 2.59V21h-4V9.75Z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.9.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
};

export default function Creator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  /* scroll reveal (fail-open: content is only hidden once JS marks the page ready) */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReduced() || !('IntersectionObserver' in window)) return;
    root.classList.add('mc--ready');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* 3D tilt on the photo */
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReduced() || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
  };
  const untilt = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  };

  /* click the photo → confetti burst */
  const burst = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReduced()) return;
    const host = e.currentTarget;
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const colors = ['#ff48b0', '#0078bf', '#ffd400', '#00a878', '#1b1b3a'];
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('span');
      el.className = `mc-bit mc-bit--${i % 3}`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.background = colors[i % colors.length];
      host.appendChild(el);
      const a = Math.random() * Math.PI * 2;
      const d = 70 + Math.random() * 110;
      el
        .animate(
          [
            { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
            {
              transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) scale(.3) rotate(${Math.random() * 720 - 360}deg)`,
              opacity: 0,
            },
          ],
          { duration: 750 + Math.random() * 450, easing: 'cubic-bezier(.2,.8,.2,1)' },
        )
        .addEventListener('finish', () => el.remove());
    }
  };

  /* magnetic link cards */
  const magnet = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (prefersReduced() || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--mx', `${(x * 10).toFixed(1)}px`);
    e.currentTarget.style.setProperty('--my', `${(y * 10).toFixed(1)}px`);
  };
  const unmagnet = (e: React.PointerEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty('--mx', '0px');
    e.currentTarget.style.setProperty('--my', '0px');
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CREATOR.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${CREATOR.email}`;
    }
  };

  const initials = CREATOR.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const links = [
    { key: 'ig', label: 'Instagram', handle: CREATOR.instagramHandle, href: CREATOR.instagram, icon: Icon.insta, c: 'pink' },
    { key: 'in', label: 'LinkedIn', handle: CREATOR.linkedinHandle, href: CREATOR.linkedin, icon: Icon.linkedin, c: 'blue' },
    { key: 'mail', label: 'Email', handle: CREATOR.email, href: `mailto:${CREATOR.email}`, icon: Icon.mail, c: 'yellow' },
    ...(CREATOR.github
      ? [{ key: 'gh', label: 'GitHub', handle: CREATOR.githubHandle, href: CREATOR.github, icon: Icon.github, c: 'mint' }]
      : []),
  ];

  const marquee = ['MADE BY A HUMAN', 'SAMBHAV 4.0', 'BUILT WITH LOVE', 'SHIPPED AT 3 AM', 'NO BUGS (PROBABLY)'];

  return (
    <div className="mc" ref={rootRef}>
      <style>{CSS}</style>

      {/* floating decorations */}
      <div className="mc-deco" aria-hidden="true">
        <i className="mc-d mc-d--star" />
        <i className="mc-d mc-d--ring" />
        <i className="mc-d mc-d--dot" />
        <i className="mc-d mc-d--tri" />
        <i className="mc-d mc-d--sq" />
      </div>

      <header className="mc-top">
        <Link to="/" className="mc-back">
          {Icon.back}
          <span>Back to Sambhav</span>
        </Link>
        <span className="mc-tag">/ the maker</span>
      </header>

      {/* ───────── HERO ───────── */}
      <section className="mc-hero">
        <div className="mc-hero__text">
          <p className="mc-kicker mc-pop" style={{ '--d': '0.05s' } as CSSProperties}>
            Meet the creator
          </p>
          <h1 className="mc-name" aria-label={CREATOR.name}>
            {CREATOR.name.split(' ').map((word, wi) => (
              <span className="mc-word" key={wi} aria-hidden="true">
                {word.split('').map((ch, i) => (
                  <span className="mc-ch" key={i} style={{ '--i': wi * 6 + i } as CSSProperties}>
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="mc-role mc-pop" style={{ '--d': '0.7s' } as CSSProperties}>
            <span className="mc-role__pre">I am a</span> <Typer words={CREATOR.roles} />
          </p>
          <p className="mc-tagline mc-pop" style={{ '--d': '0.85s' } as CSSProperties}>
            {CREATOR.tagline}
          </p>
          <div className="mc-cta mc-pop" style={{ '--d': '1s' } as CSSProperties}>
            <a href="#say-hi" className="mc-btn mc-btn--ink">
              Say hi {Icon.arrow}
            </a>
            <button type="button" className="mc-btn mc-btn--ghost" onClick={copyEmail}>
              {copied ? 'Email copied!' : 'Copy email'}
            </button>
          </div>
        </div>

        <div className="mc-hero__photo">
          <div className="mc-photo" onPointerMove={tilt} onPointerLeave={untilt} onClick={burst}>
            <div className="mc-photo__layer mc-photo__layer--a" />
            <div className="mc-photo__layer mc-photo__layer--b" />
            <div className="mc-photo__frame">
              {photoFailed ? (
                <div className="mc-photo__ph" aria-label="Photo placeholder">
                  <span>{initials}</span>
                  <small>add your photo at /public/creator.jpg</small>
                </div>
              ) : (
                <img src={CREATOR.photo} alt={`Portrait of ${CREATOR.name}`} onError={() => setPhotoFailed(true)} draggable={false} />
              )}
            </div>
            <div className="mc-badge" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <defs>
                  <path id="mc-circ" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
                </defs>
                <text>
                  <textPath href="#mc-circ">CREATOR • MAKER • BUILDER • CREATOR • MAKER •</textPath>
                </text>
              </svg>
              <b>★</b>
            </div>
            <span className="mc-hint">tap me</span>
          </div>
        </div>
      </section>

      {/* ───────── MARQUEE ───────── */}
      <div className="mc-marquee" aria-hidden="true">
        <div className="mc-marquee__track">
          {[0, 1].map((k) => (
            <div className="mc-marquee__set" key={k}>
              {marquee.map((m, i) => (
                <span key={i}>
                  {m} <em>✺</em>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ───────── STATS ───────── */}
      <section className="mc-sec">
        <div className="mc-stats">
          {CREATOR.stats.map((s, i) => (
            <div className="mc-stat" data-reveal key={i} style={{ '--r': `${i * 0.08}s` } as CSSProperties}>
              <strong>
                <Count to={s.n} suffix={s.suffix} />
              </strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── STORY ───────── */}
      <section className="mc-sec">
        <div className="mc-story" data-reveal>
          <h2 className="mc-h2">
            The <mark>story</mark>
          </h2>
          {CREATOR.bio.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* ───────── STACK ───────── */}
      <section className="mc-sec">
        <h2 className="mc-h2" data-reveal>
          Built <mark>with</mark>
        </h2>
        <ul className="mc-chips">
          {CREATOR.stack.map((t, i) => (
            <li key={t} data-reveal style={{ '--r': `${i * 0.05}s`, '--tilt': `${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg` } as CSSProperties}>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── LINKS ───────── */}
      <section className="mc-sec" id="say-hi">
        <h2 className="mc-h2" data-reveal>
          Say <mark>hi</mark>
        </h2>
        <p className="mc-sub" data-reveal>
          Found a bug? Want a site like this? Just want to chat? My inbox is open.
        </p>
        <div className="mc-links">
          {links.map((l, i) => (
            <a
              key={l.key}
              href={l.href}
              target={l.key === 'mail' ? undefined : '_blank'}
              rel="noopener noreferrer"
              className={`mc-link mc-link--${l.c}`}
              data-reveal
              style={{ '--r': `${i * 0.08}s` } as CSSProperties}
              onPointerMove={magnet}
              onPointerLeave={unmagnet}
            >
              <span className="mc-link__ico">{l.icon}</span>
              <span className="mc-link__txt">
                <b>{l.label}</b>
                <small>{l.handle}</small>
              </span>
              <span className="mc-link__go">{l.icon && Icon.arrow}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ───────── THANKS ───────── */}
      <section className="mc-sec mc-end">
        <p className="mc-thanks" data-reveal>
          {CREATOR.thanks}
        </p>
        <Link to="/" className="mc-btn mc-btn--ink" data-reveal>
          {Icon.back} Back to the fest
        </Link>
        <p className="mc-fine">Designed &amp; built with <span className="mc-heart">♥</span> for Sambhav 4.0</p>
      </section>
    </div>
  );
}

/* ───────────────────────── styles (scoped by .mc) ───────────────────────── */
const CSS = `
.mc{
  --paper:#f5efe1; --ink:#1b1b3a; --pink:#ff48b0; --blue:#0078bf; --yellow:#ffd400; --mint:#00a878;
  position:relative; min-height:100vh; background:var(--paper); color:var(--ink);
  overflow-x:clip; padding:0 clamp(16px,5vw,56px) 80px;
  background-image:radial-gradient(rgba(27,27,58,.09) 1px, transparent 1.4px); background-size:14px 14px;
  font-family:inherit;
}
.mc *, .mc *::before, .mc *::after{box-sizing:border-box}
.mc a{color:inherit;text-decoration:none}

/* decorations */
.mc-deco{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.mc-d{position:absolute;display:block;mix-blend-mode:multiply;animation:mc-float 9s ease-in-out infinite}
.mc-d--star{width:64px;height:64px;background:var(--yellow);top:9%;right:7%;clip-path:polygon(50% 0,62% 36%,100% 38%,70% 60%,80% 100%,50% 76%,20% 100%,30% 60%,0 38%,38% 36%);animation-duration:11s}
.mc-d--ring{width:90px;height:90px;border:10px solid var(--pink);border-radius:50%;top:42%;left:-30px;animation-delay:-3s}
.mc-d--dot{width:26px;height:26px;background:var(--blue);border-radius:50%;top:62%;right:6%;animation-delay:-5s}
.mc-d--tri{width:58px;height:58px;background:var(--mint);clip-path:polygon(50% 0,100% 100%,0 100%);top:80%;left:8%;animation-delay:-2s}
.mc-d--sq{width:40px;height:40px;background:var(--pink);top:27%;left:44%;transform:rotate(20deg);animation-delay:-7s;opacity:.7}
@keyframes mc-float{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -22px;rotate:14deg}}

/* top bar */
.mc-top{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:18px 0}
.mc-back{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:.85rem;text-transform:uppercase;letter-spacing:.06em;
  border:2.5px solid var(--ink);border-radius:999px;padding:9px 16px;background:#fff;box-shadow:3px 3px 0 var(--ink);transition:transform .15s,box-shadow .15s}
.mc-back:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.mc-back svg{width:16px;height:16px}
.mc-tag{font-weight:700;opacity:.55;font-size:.85rem}

/* hero */
.mc-hero{position:relative;z-index:1;display:grid;gap:34px;padding:18px 0 40px;align-items:center}
@media(min-width:860px){.mc-hero{grid-template-columns:1.15fr .85fr;gap:56px;padding-top:36px}}
.mc-kicker{display:inline-block;margin:0 0 14px;padding:6px 14px;background:var(--ink);color:var(--paper);font-weight:800;
  text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;border-radius:6px;transform:rotate(-2deg)}
.mc-name{margin:0;font-size:clamp(2.7rem,12.5vw,6.6rem);line-height:.92;font-weight:900;letter-spacing:-.035em;text-transform:uppercase;display:flex;flex-wrap:wrap;column-gap:.28em}
.mc-word{display:inline-flex}
.mc-ch{display:inline-block;animation:mc-drop .8s cubic-bezier(.2,1.3,.4,1) backwards;animation-delay:calc(var(--i) * 55ms + .15s);
  text-shadow:.045em .045em 0 var(--pink),-.03em -.03em 0 var(--blue);transition:transform .25s}
.mc-ch:hover{transform:translateY(-.1em) rotate(-6deg)}
@keyframes mc-drop{from{opacity:0;transform:translateY(-.9em) rotate(-14deg) scale(.6)}to{opacity:1;transform:none}}
.mc-pop{animation:mc-pop .7s cubic-bezier(.2,1,.3,1) backwards;animation-delay:var(--d,0s)}
@keyframes mc-pop{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.mc-role{margin:22px 0 8px;font-size:clamp(1.1rem,4.6vw,1.65rem);font-weight:800;min-height:2.1em}
.mc-role__pre{opacity:.6;font-weight:600}
.mc-typer{background:linear-gradient(transparent 58%, var(--yellow) 58%);padding:0 4px}
.mc-caret{display:inline-block;width:3px;height:1em;background:var(--ink);margin-left:3px;vertical-align:-.12em;animation:mc-blink 1s steps(1) infinite}
@keyframes mc-blink{50%{opacity:0}}
.mc-tagline{margin:0 0 24px;max-width:36ch;font-size:1.05rem;line-height:1.55;opacity:.8}
.mc-cta{display:flex;flex-wrap:wrap;gap:12px}
.mc-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;font:inherit;font-weight:800;font-size:.92rem;
  text-transform:uppercase;letter-spacing:.05em;border:2.5px solid var(--ink);border-radius:14px;padding:14px 22px;
  box-shadow:4px 4px 0 var(--ink);transition:transform .15s,box-shadow .15s;min-height:48px}
.mc-btn svg{width:18px;height:18px}
.mc-btn:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
.mc-btn:active{transform:translate(4px,4px);box-shadow:0 0 0 var(--ink)}
/* Explicit button colors: protect against global link/button styles */
.mc .mc-btn--ink,
.mc .mc-btn--ink:visited {
  background: var(--ink);
  color: #f5efe1 !important;
  -webkit-text-fill-color: #f5efe1;
}
.mc .mc-btn--ghost,
.mc .mc-btn--ghost:visited {
  background: #ffffff;
  color: #1b1b3a !important;
  -webkit-text-fill-color: #1b1b3a;
}
.mc .mc-btn--ink svg,
.mc .mc-btn--ghost svg {
  color: inherit;
  stroke: currentColor;
}

/* photo */
.mc-hero__photo{display:flex;justify-content:center;perspective:900px}
.mc-photo{--rx:0deg;--ry:0deg;position:relative;width:min(78vw,340px);aspect-ratio:4/5;cursor:pointer;
  transform:rotateX(var(--rx)) rotateY(var(--ry));transition:transform .2s ease-out;transform-style:preserve-3d;
  animation:mc-photo-in 1s cubic-bezier(.2,1.2,.3,1) .3s backwards;-webkit-tap-highlight-color:transparent;user-select:none}
@keyframes mc-photo-in{from{opacity:0;transform:scale(.7) rotate(-10deg)}to{opacity:1}}
.mc-photo__layer{position:absolute;inset:0;border-radius:46% 54% 40% 60% / 50% 40% 60% 50%;mix-blend-mode:multiply;animation:mc-morph 9s ease-in-out infinite}
.mc-photo__layer--a{background:var(--pink);transform:translate(-14px,12px) rotate(-5deg)}
.mc-photo__layer--b{background:var(--blue);transform:translate(14px,-10px) rotate(4deg);animation-delay:-4s}
.mc-photo__frame{position:absolute;inset:0;border:3px solid var(--ink);overflow:hidden;background:var(--yellow);
  border-radius:46% 54% 40% 60% / 50% 40% 60% 50%;animation:mc-morph 9s ease-in-out infinite;animation-delay:-2s}
.mc-photo__frame img{width:100%;height:100%;object-fit:cover;display:block;filter:contrast(1.06) saturate(1.05)}
@keyframes mc-morph{
  0%,100%{border-radius:46% 54% 40% 60% / 50% 40% 60% 50%}
  33%{border-radius:58% 42% 56% 44% / 42% 58% 42% 58%}
  66%{border-radius:40% 60% 46% 54% / 58% 44% 56% 42%}}
.mc-photo__ph{height:100%;display:grid;place-content:center;text-align:center;gap:8px}
.mc-photo__ph span{font-size:clamp(4rem,22vw,7rem);font-weight:900;letter-spacing:-.04em}
.mc-photo__ph small{font-weight:700;opacity:.6;font-size:.72rem;padding:0 16px}
.mc-badge{position:absolute;right:-18px;bottom:-14px;width:112px;height:112px;border-radius:50%;background:var(--paper);border:3px solid var(--ink);
  display:grid;place-items:center;transform:translateZ(40px)}
.mc-badge svg{position:absolute;inset:0;width:100%;height:100%;animation:mc-spin 14s linear infinite}
.mc-badge text{font-size:11.5px;font-weight:800;letter-spacing:.09em;fill:var(--ink)}
.mc-badge b{font-size:1.9rem;color:var(--pink);animation:mc-pulse 1.8s ease-in-out infinite}
@keyframes mc-spin{to{rotate:360deg}}
@keyframes mc-pulse{50%{scale:1.25}}
.mc-hint{position:absolute;left:-6px;top:-10px;background:var(--yellow);border:2.5px solid var(--ink);border-radius:8px;padding:3px 10px;
  font-weight:800;font-size:.72rem;text-transform:uppercase;transform:rotate(-8deg);animation:mc-wiggle 2.4s ease-in-out infinite}
@keyframes mc-wiggle{0%,100%{rotate:-4deg}50%{rotate:5deg}}
.mc-bit{position:absolute;width:11px;height:11px;pointer-events:none;z-index:5}
.mc-bit--1{border-radius:50%}
.mc-bit--2{clip-path:polygon(50% 0,100% 100%,0 100%)}

/* marquee */
.mc-marquee{position:relative;z-index:1;margin:10px calc(-1 * clamp(16px,5vw,56px));background:var(--ink);color:var(--paper);overflow:hidden;
  transform:rotate(-1.6deg);border-block:3px solid var(--ink)}
.mc-marquee__track{display:flex;width:max-content;animation:mc-marq 28s linear infinite}
.mc-marquee__set{display:flex;flex-shrink:0}
.mc-marquee span{padding:14px 22px;font-weight:900;font-size:1.05rem;letter-spacing:.1em;white-space:nowrap}
.mc-marquee em{font-style:normal;color:var(--yellow);margin-left:22px}
@keyframes mc-marq{to{transform:translateX(-50%)}}

/* sections */
.mc-sec{position:relative;z-index:1;padding:54px 0 6px;max-width:980px;margin:0 auto}
.mc-h2{margin:0 0 22px;font-size:clamp(2rem,8vw,3.4rem);font-weight:900;letter-spacing:-.03em;text-transform:uppercase;line-height:1}
.mc-h2 mark{background:var(--pink);color:var(--ink);padding:0 .18em;border-radius:6px;display:inline-block;transform:rotate(-2deg)}
.mc-sub{margin:-6px 0 26px;font-size:1.05rem;opacity:.75;max-width:46ch}

/* reveal */
.mc--ready [data-reveal]{opacity:0;transform:translateY(34px) scale(.97);transition:opacity .7s ease,transform .8s cubic-bezier(.2,1,.3,1);transition-delay:var(--r,0s)}
.mc--ready [data-reveal].in{opacity:1;transform:none}

/* stats */
.mc-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(min-width:760px){.mc-stats{grid-template-columns:repeat(4,1fr)}}
.mc-stat{background:#fff;border:3px solid var(--ink);border-radius:18px;padding:20px 16px;box-shadow:5px 5px 0 var(--ink);text-align:center}
.mc-stat:nth-child(1){background:var(--yellow)}
.mc-stat:nth-child(2){background:#ffd1ec}
.mc-stat:nth-child(3){background:#cde8f7}
.mc-stat:nth-child(4){background:#c8f0e1}
.mc-stat strong{display:block;font-size:clamp(2rem,9vw,3rem);font-weight:900;line-height:1;letter-spacing:-.03em}
.mc-stat span{display:block;margin-top:8px;font-weight:700;font-size:.82rem;text-transform:uppercase;letter-spacing:.06em}

/* story */
.mc-story{background:#fff;border:3px solid var(--ink);border-radius:22px;padding:clamp(22px,5vw,40px);box-shadow:8px 8px 0 var(--pink)}
.mc-story p{margin:0 0 14px;font-size:1.08rem;line-height:1.7}
.mc-story p:last-child{margin:0}

/* chips */
.mc-chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:12px}
.mc-chips li{border:2.5px solid var(--ink);border-radius:999px;padding:10px 20px;background:#fff;font-weight:800;box-shadow:3px 3px 0 var(--ink);
  rotate:var(--tilt,0deg);transition:rotate .25s,translate .25s,background .2s;cursor:default}
.mc-chips li:nth-child(3n+1):hover{background:var(--yellow)}
.mc-chips li:nth-child(3n+2):hover{background:#ffd1ec}
.mc-chips li:nth-child(3n):hover{background:#cde8f7}
.mc-chips li:hover{rotate:0deg;translate:0 -5px}

/* links */
.mc-links{display:grid;gap:16px}
@media(min-width:700px){.mc-links{grid-template-columns:1fr 1fr}}
.mc-link{--mx:0px;--my:0px;display:flex;align-items:center;gap:16px;padding:18px 20px;border:3px solid var(--ink);border-radius:20px;background:#fff;
  box-shadow:6px 6px 0 var(--ink);min-height:84px;position:relative;overflow:hidden;
  translate:var(--mx) var(--my);transition:box-shadow .2s,background .25s,translate .15s}
.mc-link::before{content:"";position:absolute;inset:0;background:var(--bg);transform:translateY(101%);transition:transform .35s cubic-bezier(.2,1,.3,1);z-index:0}
.mc-link:hover::before,.mc-link:focus-visible::before{transform:none}
.mc-link:hover{box-shadow:2px 2px 0 var(--ink)}
.mc-link:focus-visible,.mc-btn:focus-visible,.mc-back:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
.mc-link > *{position:relative;z-index:1}
.mc-link--pink{--bg:var(--pink)}.mc-link--blue{--bg:#6ab7e8}.mc-link--yellow{--bg:var(--yellow)}.mc-link--mint{--bg:#5fd6b0}
.mc-link__ico{flex:none;width:52px;height:52px;border-radius:14px;background:var(--ink);color:var(--paper);display:grid;place-items:center;transition:rotate .35s}
.mc-link__ico svg{width:26px;height:26px}
.mc-link:hover .mc-link__ico{rotate:-12deg}
.mc-link__txt{flex:1;min-width:0;display:flex;flex-direction:column}
.mc-link__txt b{font-size:1.15rem;font-weight:900;text-transform:uppercase;letter-spacing:.02em}
.mc-link__txt small{font-weight:700;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-link__go{flex:none;width:30px;height:30px;transition:transform .25s}
.mc-link__go svg{width:100%;height:100%}
.mc-link:hover .mc-link__go{transform:translate(4px,-4px)}

/* end */
.mc-end{text-align:center;padding-top:72px;display:flex;flex-direction:column;align-items:center;gap:22px}
.mc-thanks{margin:0;font-size:clamp(1.3rem,5vw,2rem);font-weight:800;line-height:1.3;max-width:24ch}
.mc-fine{margin:6px 0 0;font-weight:700;font-size:.85rem;opacity:.6}
.mc-heart{display:inline-block;color:var(--pink);animation:mc-beat 1.2s ease-in-out infinite}
@keyframes mc-beat{0%,100%{scale:1}15%{scale:1.35}30%{scale:1}45%{scale:1.25}}

@media (prefers-reduced-motion: reduce){
  .mc *, .mc *::before, .mc *::after{animation:none !important;transition:none !important}
}
`;