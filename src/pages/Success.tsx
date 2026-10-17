import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { HelpFooter } from '../components/HelpFooter';
import { DOMAIN_MAP } from '../config';
import { formatIST } from '../lib/dates';

interface SuccessState {
  fullName: string;
  domainSlug: string;
  domainName: string;
  registeredAt: string;
  roll: string;
  photoUrl?: string;
}

// ---- animation helpers (Web Animations API, no library needed) -------------
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
const EASE_BACK = 'cubic-bezier(.34, 1.56, .64, 1)';
const EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)';
const INK_COLORS = ['#2B34F0', '#FF6FA8', '#35CDB2', '#FFB81C', '#14123A'];

// Safe fallback if the stylesheet for the title mask is missing
const WORD_MASK: React.CSSProperties = {
  display: 'inline-block',
  overflow: 'hidden',
  verticalAlign: 'top',
  padding: '.08em 0 .14em',
  margin: '-.08em 0 -.14em',
};

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const { show } = useToast();

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  const [data] = useState<SuccessState | null>(() => {
    const state = location.state as SuccessState | null;
    if (state?.fullName) {
      return state;
    }
    // Fallback to sessionStorage
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith('sambhav_success_'));
    if (keys.length > 0) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(keys[0])!) as SuccessState;
        if (saved?.fullName) return saved;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Redirect if there is nothing to show + auto-clear sessionStorage after 30 min (spec §9.3)
  useEffect(() => {
    if (!data) {
      navigate('/', { replace: true });
      show('Nothing to show here.', 'info');
      return;
    }

    const timer = setTimeout(() => {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('sambhav_success_'))
        .forEach((k) => sessionStorage.removeItem(k));
    }, 30 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [data, navigate, show]);

  // Entrance animation. Purely decorative: if animations are unsupported or the
  // user prefers reduced motion, nothing is hidden and the page is fully usable.
  useEffect(() => {
    const root = rootRef.current;
    if (!data || !root) return;

    // Screen readers: move focus to the heading
    titleRef.current?.focus({ preventScroll: true });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof Element.prototype.animate !== 'function') return;

    const running: Animation[] = [];
    const timers: number[] = [];
    const bursts: HTMLElement[] = [];

    const play = (
      target: Element | ArrayLike<Element> | null,
      frames: Keyframe[],
      opts: KeyframeAnimationOptions,
      step = 0
    ) => {
      if (!target) return;
      const list: Element[] = target instanceof Element ? [target] : Array.from(target);
      list.forEach((el, i) => {
        running.push(
          el.animate(frames, {
            fill: 'backwards', // holds the "from" state during the delay, then reverts to the real CSS
            easing: EASE_OUT,
            ...opts,
            delay: (Number(opts.delay) || 0) + i * step,
          })
        );
      });
    };

    const q = (sel: string) => root.querySelector(sel);
    const qa = (sel: string) => root.querySelectorAll(sel);

    // 1. Overprinting discs pop in
    play(qa('.sx-disc'), [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 800, easing: EASE_BACK }, 120);

    // 2. Photo pops in
    play(
      q('.sx-ph .pv'),
      [{ transform: 'scale(.55)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 800, delay: 100, easing: EASE_BACK }
    );

    // 3. Ring draws around the photo
    play(
      q('.sx-ring circle'),
      [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }],
      { duration: 1100, delay: 250, easing: EASE_IN_OUT }
    );

    // 4. "Registered" sticker spins in
    play(
      q('.sx-badge'),
      [
        { scale: '0', rotate: '-58deg', opacity: 0 },
        { scale: '1', rotate: '-8deg', opacity: 1 },
      ],
      { duration: 600, delay: 800, easing: EASE_BACK }
    );

    // 5. Headline words slide up out of their masks
    play(
      qa('.sx__title .wi'),
      [{ transform: 'translateY(115%)' }, { transform: 'translateY(0)' }],
      { duration: 850, delay: 500, easing: 'cubic-bezier(.2, .8, .2, 1)' },
      90
    );

    // 6. Subtitle + tip
    play(
      qa('.sx__sub, .sx__tip'),
      [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 600, delay: 900 },
      80
    );

    // 7. Team pass drops in and straightens
    play(
      q('.pass'),
      [
        { transform: 'translateY(60px)', opacity: 0, rotate: '4deg' },
        { transform: 'translateY(0)', opacity: 1, rotate: '-1deg' },
      ],
      { duration: 900, delay: 1000, easing: EASE_BACK }
    );

    // 8. Pass rows slide in one by one
    play(
      qa('.pass dl > div'),
      [{ transform: 'translateX(-16px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 500, delay: 1400 },
      100
    );

    // 9. Next-steps card, buttons, edit link
    play(
      qa('.next, .sx__links, .sx__edit'),
      [{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 600, delay: 1700 },
      100
    );

    // 10. Confetti burst + gentle floating discs once the intro has played
    const stage = q('.sx__stage') as HTMLElement | null;
    timers.push(
      window.setTimeout(() => {
        qa('.sx-disc').forEach((el, i) => {
          running.push(
            el.animate(
              [{ translate: '0 0' }, { translate: `0 ${i % 2 ? 10 : -10}px` }],
              { duration: 3200 + i * 700, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
            )
          );
        });

        if (!stage) return;
        for (let i = 0; i < 26; i++) {
          const dot = document.createElement('i');
          dot.setAttribute('aria-hidden', 'true');
          Object.assign(dot.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '11px',
            height: '11px',
            margin: '-5.5px 0 0 -5.5px',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: INK_COLORS[i % INK_COLORS.length],
          });
          stage.appendChild(dot);
          bursts.push(dot);

          const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.3;
          const dist = 120 + Math.random() * 90;
          const a = dot.animate(
            [
              { transform: `translate(0, 0) scale(${0.5 + Math.random() * 0.9})`, opacity: 1 },
              {
                transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist * 0.8}px) scale(0)`,
                opacity: 0,
              },
            ],
            { duration: 1100 + Math.random() * 500, easing: EASE_OUT, fill: 'forwards' }
          );
          a.onfinish = () => dot.remove();
          running.push(a);
        }
      }, 1400)
    );

    return () => {
      running.forEach((a) => a.cancel());
      timers.forEach((t) => clearTimeout(t));
      bursts.forEach((b) => b.remove());
    };
  }, [data]);

  if (!data) return null;

  const domainConfig = DOMAIN_MAP[data.domainSlug];
  const whatsappUrl = domainConfig?.whatsappUrl;
  const firstName = data.fullName.trim().split(/\s+/)[0] || data.fullName;
  const tone = domainConfig?.tone || 'sun';

  return (
    <div className="riso-shell">
      <div className="riso app" data-tone={tone}>
        <p className="sr-only" role="status">Registration complete.</p>

        <div className="sx" ref={rootRef}>
          <div className="sx__top">
            <Link to="/" className="brand" aria-label="Sambhav 4.0 home">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle className="a" cx="13" cy="18" r="12" />
                <circle className="b" cx="23" cy="18" r="12" />
              </svg>
              Sambhav 4.0
            </Link>
          </div>

          <div className="sx__stage">
            <i className="sx-disc sx-disc--a" aria-hidden="true" />
            <i className="sx-disc sx-disc--b" aria-hidden="true" />
            <i className="sx-disc sx-disc--c" aria-hidden="true" />
            <div className="sx-ph">
              <svg className="sx-ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="49" pathLength={1} strokeDasharray="1" />
              </svg>
              <div className="pv">
                {data.photoUrl && !photoFailed ? (
                  <img
                    src={data.photoUrl}
                    alt="Your photo"
                    onError={() => setPhotoFailed(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: '100%',
                      height: '100%',
                      fontSize: '48px',
                      fontWeight: 800,
                      background: 'var(--paper-deep)',
                    }}
                  >
                    {data.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <span className="sx-badge">
                <i>
                  <svg className="ic"><use href="#i-check" /></svg>
                </i>
                Registered
              </span>
            </div>
          </div>

          <h1
            className="sx__title"
            ref={titleRef}
            tabIndex={-1}
            aria-label="You’re in!"
            style={{ outline: 'none' }}
          >
            <span className="w" aria-hidden="true" style={WORD_MASK}>
              <span className="wi" style={{ display: 'inline-block' }}>You’re</span>
            </span>{' '}
            <span className="w" aria-hidden="true" style={WORD_MASK}>
              <span className="wi" style={{ display: 'inline-block' }}>in!</span>
            </span>
          </h1>
          <p className="sx__sub">
            Welcome to the <b>{data.domainName}</b> team, <b>{firstName}</b>.
          </p>

          <article className="pass" aria-label="Your Sambhav 4.0 team pass">
            <div className="pass__top">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <use href={`#g-${domainConfig?.glyph || data.domainSlug}`} />
              </svg>
              <div>
                <b>Team pass</b>
                <span>Sambhav 4.0</span>
              </div>
            </div>
            <div className="pass__perf" aria-hidden="true" />
            <div className="pass__body">
              <p className="pass__name">{data.fullName}</p>
              <dl>
                <div>
                  <dt>Domain</dt>
                  <dd>{data.domainName}</dd>
                </div>
                <div>
                  <dt>Roll number</dt>
                  <dd>{data.roll}</dd>
                </div>
                <div>
                  <dt>Registered</dt>
                  <dd>{formatIST(data.registeredAt)}</dd>
                </div>
              </dl>
            </div>
          </article>

          <p className="sx__tip">Take a screenshot of this page for your records.</p>

          <section className="next" aria-labelledby="nx-h">
            <h2 id="nx-h">What happens next</h2>
            <p>
              The core team will contact you through the domain WhatsApp group. Keep your phone number active.
            </p>
            {whatsappUrl && (
              <a
                className="btn btn--ink btn--block"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg className="ic" aria-hidden="true">
                  <use href="#i-wa" />
                </svg>
                <span>Join the {data.domainName} group</span>
              </a>
            )}
          </section>

          <div className="sx__links">
            <Link to="/" className="btn btn--line btn--block">
              Back to home
            </Link>
          </div>

          <p className="sx__edit">
            Made a mistake? <Link to="/request-edit" className="linkbtn">Request an edit</Link>
          </p>
        </div>

        <HelpFooter
          whatsappOnly
          title="Need a hand?"
          desc="Something looks wrong on your pass? Message the core team."
        />
      </div>
    </div>
  );
}