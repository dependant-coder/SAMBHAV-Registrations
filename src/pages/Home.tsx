// Home.tsx — Landing page per spec §9.1
import { useState, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, svg } from 'animejs';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DomainCard } from '../components/DomainCard';
import { GlobalBanners } from '../components/Banner';
import { useApp } from '../contexts/AppContext';
import { DOMAINS, FEST_NAME } from '../config';

const FAQ_ITEMS = [
  {
    q: "I can’t find my name. What do I do?",
    a: "Choose the correct domain first. Then type your full name exactly as it is on the team list. Capital letters don’t matter. If it still fails, tap “Report a problem with my name”.",
  },
  {
    q: "Which domain should I pick?",
    a: "The one you were selected for. Your domain head can share a direct link too.",
  },
  {
    q: "I made a mistake after submitting. Can I fix it?",
    a: "Yes. Use Request an edit. A core team member reviews it, and if it’s approved you get 48 hours to make the change.",
  },
  {
    q: "What kind of photo should I upload?",
    a: "A clear, front-facing photo of just you, in good light. You can crop it on the next screens.",
  },
  {
    q: "My photo won’t upload.",
    a: "Try “Choose from gallery”, or take a new photo. If you opened this link inside Instagram or another app, open it in Chrome or Safari instead.",
  },
  {
    q: "Do I need to create an account?",
    a: "No. Members don’t log in.",
  },
  {
    q: "Who can see my details?",
    a: "Only the Sambhav core team.",
  },
  {
    q: "I don’t have a second phone number.",
    a: "The alternate number is optional. Leave it empty.",
  },
];

const CHECKLIST_ITEMS = [
  "Your **full name** exactly as written on the team list. Capital letters don’t matter.",
  "Your **college roll number**, as printed on your ID card.",
  "Your **10-digit mobile number**.",
  "An **email address** you check regularly.",
  "A clear, front-facing **photo of yourself**. You can take one when you get there."
];

export default function Home() {
  const { registrationIsOpen, settings } = useApp();
  const [checklist, setChecklist] = useState<boolean[]>(new Array(CHECKLIST_ITEMS.length).fill(false));
  const rootRef = useRef<HTMLDivElement>(null);

  const toggleCheck = (index: number) => {
    setChecklist(prev => {
      const next = [...prev];
      next[index] = !next[index];
      const li = rootRef.current?.querySelectorAll('#ready li')[index];
      if (next[index] && li) {
        const tick = li.querySelector('.tick');
        if (tick) {
          gsap.fromTo(tick, { scale: 0.55 }, { scale: 1, duration: 0.6, ease: 'back.out(3.2)', overwrite: true });
        }
      }
      const all = next.every(Boolean);
      const done = rootRef.current?.querySelector('#ready-done') as HTMLElement;
      if (done) {
        gsap.to(done, { 
          height: all ? 'auto' : 0, 
          opacity: all ? 1 : 0, 
          marginTop: all ? 16 : 0,
          duration: 0.45, 
          ease: 'power3.out',
          overwrite: true 
        });
      }
      return next;
    });
  };

  const handleFaqClick = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const faqEl = rootRef.current?.querySelector(`#faq-item-${index}`) as HTMLDetailsElement;
    if (!faqEl) return;
    const bodyEl = faqEl.querySelector('.faq__body') as HTMLElement;
    const contentEl = bodyEl?.querySelector('.faq__a') as HTMLElement;

    if (faqEl.classList.contains('is-open')) {
      faqEl.classList.remove('is-open');
      if (bodyEl) gsap.killTweensOf(bodyEl);
      gsap.to(bodyEl, {
        height: 0,
        duration: 0.32,
        ease: 'power2.inOut',
        onComplete: () => {
          faqEl.open = false;
          if (bodyEl) bodyEl.style.height = '';
        }
      });
    } else {
      const others = rootRef.current?.querySelectorAll('.faq details.is-open');
      others?.forEach(other => {
        const otherDetails = other as HTMLDetailsElement;
        const otherBody = otherDetails.querySelector('.faq__body') as HTMLElement;
        otherDetails.classList.remove('is-open');
        if (otherBody) gsap.killTweensOf(otherBody);
        gsap.to(otherBody, {
          height: 0,
          duration: 0.32,
          ease: 'power2.inOut',
          onComplete: () => {
            otherDetails.open = false;
            if (otherBody) otherBody.style.height = '';
          }
        });
      });

      faqEl.open = true;
      faqEl.classList.add('is-open');
      if (bodyEl) {
        gsap.killTweensOf(bodyEl);
        gsap.fromTo(bodyEl, { height: 0 }, {
          height: 'auto',
          duration: 0.45,
          ease: 'power3.out',
          onComplete: () => { bodyEl.style.height = ''; }
        });
      }
      if (contentEl) {
        gsap.fromTo(contentEl, { y: -10, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.45,
          delay: 0.05,
          ease: 'power3.out'
        });
      }
    }
  };

  useLayoutEffect(() => {
    const root = document.documentElement;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (isReduced) {
      root.classList.remove('js-anim');
      return;
    }

    root.classList.add('js-anim');
    
    // Fallback: remove js-anim if something fails or takes too long
    const timeoutId = setTimeout(() => {
      // @ts-ignore
      if (!window.__sambhavAnimReady) {
        root.classList.remove('js-anim');
      }
    }, 4000);

    const ctx = gsap.context(() => {
      gsap.registerPlugin(ScrollTrigger);

      // Helper: split words into spans for reveal animation
      const splitWords = (el: HTMLElement) => {
        const text = el.textContent?.trim() || '';
        el.setAttribute('aria-label', text);
        el.innerHTML = text.split(/\s+/).map(w => `<span class="w" aria-hidden="true"><span class="wi">${w}</span></span>`).join(' ');
        return el.querySelectorAll('.wi');
      };

      // 1. HERO Animation (Anime.js)
      const glyphs = rootRef.current?.querySelectorAll('.gp:not(.gp--dot)');
      const dot = rootRef.current?.querySelector('.gp--dot');
      const sticker = rootRef.current?.querySelector('#sticker') as HTMLElement;
      const heroTitle = rootRef.current?.querySelector('.hero-copy h1') as HTMLElement;
      const heroWords = splitWords(heroTitle);

      const playHero = (t0: number) => {
        glyphs?.forEach((g) => {
          (g as SVGPathElement).style.fillOpacity = '0';
          (g as SVGPathElement).style.strokeOpacity = '1';
        });
        if (dot) {
          (dot as HTMLElement).style.transform = 'scale(0)';
        }
        const freshDrawables = svg.createDrawable(Array.from(glyphs || []) as SVGPathElement[]);
        // 1) each letter is traced…
        animate(freshDrawables, { 
          draw: ['0 0', '0 1'], 
          duration: 850, 
          delay: stagger(200, { start: t0 }), 
          ease: 'inOutSine' 
        });
        // 2) …then filled in, and the outline melts away
        animate(Array.from(glyphs || []), { 
          fillOpacity: [0, 1], 
          duration: 380, 
          delay: stagger(200, { start: t0 + 600 }), 
          ease: 'outQuad' 
        });
        animate(Array.from(glyphs || []), { 
          strokeOpacity: [1, 0], 
          duration: 320, 
          delay: stagger(200, { start: t0 + 760 }), 
          ease: 'linear' 
        });
        // 3) the dot lands last, like a pen tap
        if (dot) {
          animate(dot, { 
            scale: [0, 1], 
            duration: 650, 
            delay: t0 + 1150, 
            ease: 'outBack(3)' 
          });
        }
      };

      // Initial hero entry
      animate('.brand__mark .a', { translateX: [-9, 0], duration: 900, ease: 'outExpo' });
      animate('.brand__mark .b', { translateX: [9, 0], duration: 900, ease: 'outExpo' });
      
      playHero(350);

      // Floating discs (drift slowly)
      const floats = [
        animate('.disc--sun', { translateY: [-5, 7], duration: 4200, delay: 2200, alternate: true, loop: true, ease: 'inOutSine' }),
        animate('.disc--pink', { translateY: [6, -6], duration: 5000, delay: 2200, alternate: true, loop: true, ease: 'inOutSine' }),
        animate('.disc--mint', { translateY: [-4, 6], duration: 3600, delay: 2200, alternate: true, loop: true, ease: 'inOutSine' })
      ];

      ScrollTrigger.create({
        trigger: '#hero-art',
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self: any) => {
          floats.forEach((f: any) => self.isActive ? f.play() : f.pause());
        }
      });

      // Tap to replay glyph
      const heroArt = rootRef.current?.querySelector('#hero-art');
      if (heroArt) {
        heroArt.addEventListener('click', () => playHero(0));
      }

      animate(Array.from(heroWords), { translateY: ['110%', '0%'], duration: 900, delay: stagger(80, { start: 1100 }), ease: 'outExpo' });
      animate('.lead', { opacity: [0, 1], translateY: [14, 0], duration: 800, delay: 1500, ease: 'outExpo' });
      animate('#cta', { opacity: [0, 1], scale: [0.88, 1], duration: 700, delay: 1650, ease: 'outBack(2.2)' });
      animate('.meaning', { opacity: [0, 1], duration: 700, delay: 1950, ease: 'outQuad' });

      if (sticker) {
        sticker.textContent = '0.0';
        const counter = { v: 0 };
        animate(sticker, { opacity: [0, 1], scale: [0.4, 1], duration: 600, delay: 1650, ease: 'outBack(2.5)' });
        animate(counter, {
          v: 4,
          duration: 900,
          delay: 1700,
          ease: 'outExpo',
          onUpdate: () => { sticker.textContent = counter.v.toFixed(1); },
          onComplete: () => { sticker.textContent = '4.0'; }
        });
      }

      // 2. Scroll Progress
      gsap.to('.progress__bar', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 0.2 }
      });

      // 3. Section Titles Reveal
      rootRef.current?.querySelectorAll('.sec__title, .foot h2').forEach((h) => {
        const words = splitWords(h as HTMLElement);
        gsap.fromTo(words, { yPercent: 115, opacity: 1 }, {
          yPercent: 0,
          duration: 0.85,
          stagger: 0.07,
          ease: 'power4.out',
          scrollTrigger: { trigger: h, start: 'top 88%', once: true }
        });
      });

      // 4. Keep These Ready Animation
      const ready = rootRef.current?.querySelector('#ready');
      const done = rootRef.current?.querySelector('#ready-done');
      
      if (ready && done) {
        // Uncheck all boxes initially to let them animate
        const boxes = ready.querySelectorAll('.check__input') as NodeListOf<HTMLInputElement>;
        boxes.forEach(b => b.checked = false);

        ScrollTrigger.create({
          trigger: ready,
          start: 'top 80%',
          once: true,
          onEnter: () => {
            const tl = gsap.timeline();
            tl.to(ready, { '--line': '0%', duration: 0.9, ease: 'power3.out' }, 0);
            ready.querySelectorAll('li').forEach((li, i) => {
              const t = 0.35 + i * 0.3;
              const text = li.querySelector('.check__text');
              const strongs = li.querySelectorAll('strong');
              const tick = li.querySelector('.tick');

              tl.fromTo(text, { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out' }, t)
                .add(() => {
                  setChecklist(prev => {
                    const next = [...prev];
                    next[i] = true;
                    return next;
                  });
                  if (tick) {
                    gsap.fromTo(tick, { scale: 0.55 }, { scale: 1, duration: 0.6, ease: 'back.out(3.2)', overwrite: true });
                  }
                }, t + 0.14)
                .to(strongs, { '--hl': '100%', duration: 0.55, ease: 'power2.out' }, t + 0.3);
            });
            
            // Reveal the "done" message after all items are checked
            tl.add(() => {
              setChecklist(new Array(CHECKLIST_ITEMS.length).fill(true));
              gsap.to(done, { height: 'auto', opacity: 1, marginTop: 16, duration: 0.45, ease: 'power3.out' });
            }, '>-0.1');
          }
        });
      }

      // 5. Domain Tiles
      ScrollTrigger.batch('.tile', {
        start: 'top 92%',
        once: true,
        onEnter: (batch: any) => {
          gsap.fromTo(batch,
            { y: 30, scale: 0.92, rotate: (i: number) => i % 2 ? 2 : -2, opacity: 0 },
            { y: 0, scale: 1, rotate: 0, opacity: 1, duration: 0.75, stagger: 0.09, ease: 'back.out(1.6)', clearProps: 'transform' });
          
          const tileGlyphs = batch.map((t: HTMLElement) => t.querySelector('.tile__glyph'));
          gsap.fromTo(tileGlyphs,
            { scale: 0.4, rotate: -50, opacity: 0 },
            { scale: 1, rotate: 0, opacity: 1, duration: 0.9, stagger: 0.09, delay: 0.2, ease: 'elastic.out(1, 0.55)', clearProps: 'transform,opacity' });
        }
      });

      // 6. How It Works Timeline
      const wrap = rootRef.current?.querySelector('#steps-wrap');
      const track = rootRef.current?.querySelector('#steps-track') as HTMLElement;
      const fill = rootRef.current?.querySelector('#steps-fill');
      const head = rootRef.current?.querySelector('#steps-head');
      const steps = rootRef.current?.querySelectorAll('.step');
      const LINE = '62%';

      if (wrap && steps && track && fill && head) {
        const measureTrack = () => {
          const stepNums = Array.from(steps).map(s => s.querySelector('.step__num') as HTMLElement);
          const firstNum = stepNums[0];
          const lastNum = stepNums[stepNums.length - 1];
          if (!firstNum || !lastNum) return 0;
          const h = lastNum.getBoundingClientRect().top - firstNum.getBoundingClientRect().top;
          track.style.height = h + 'px';
          return h;
        };

        let trackH = measureTrack();
        gsap.set(fill, { scaleY: 0 });
        gsap.set(head, { y: 0 });

        gsap.timeline({
          scrollTrigger: {
            trigger: wrap, scrub: 0.5, invalidateOnRefresh: true,
            start: () => { trackH = measureTrack(); return 'top+=22 ' + LINE; },
            end: () => { trackH = measureTrack(); return 'top+=' + (22 + trackH) + ' ' + LINE; }
          }
        }).to(fill, { scaleY: 1, ease: 'none' }, 0).to(head, { y: () => trackH, ease: 'none' }, 0);

        // Step Illustrations Timeline Creators
        const stepArts = [
          (li: HTMLElement) => { // Step 1
            const blocks = li.querySelectorAll('.s1a');
            const sel = li.querySelector('.s1sel');
            gsap.set(blocks, { scale: 0, transformOrigin: '50% 50%' });
            gsap.set(sel, { scale: 1.5, opacity: 0, transformOrigin: '50% 50%' });
            return gsap.timeline()
              .to(blocks, { scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(2.4)' })
              .to(sel, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, '>-0.05');
          },
          (li: HTMLElement) => { // Step 2
            const type = li.querySelector('.s2type');
            const ok = li.querySelector('.s2ok');
            const okc = li.querySelector('.s2okc');
            gsap.set(type, { strokeDashoffset: 1 });
            gsap.set(okc, { strokeDashoffset: 1 });
            gsap.set(ok, { scale: 0, transformOrigin: '50% 50%' });
            return gsap.timeline()
              .to(type, { strokeDashoffset: 0, duration: 0.7, ease: 'steps(7)' })
              .to(ok, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, '>0.05')
              .to(okc, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, '>-0.15');
          },
          (li: HTMLElement) => { // Step 3
            const bars = li.querySelectorAll('.s3bar');
            gsap.set(bars, { scaleX: 0, transformOrigin: '0% 50%' });
            return gsap.timeline().to(bars, { scaleX: 1, duration: 0.6, stagger: 0.14, ease: 'power3.out' });
          },
          (li: HTMLElement) => { // Step 4
            const disc = li.querySelector('.s4disc');
            const head = li.querySelector('.s4head');
            const body = li.querySelector('.s4body');
            const brk = li.querySelector('.s4brk');
            gsap.set(disc, { scale: 0, transformOrigin: '50% 50%' });
            gsap.set(head, { y: 14, opacity: 0 });
            gsap.set(body, { y: 16, opacity: 0 });
            gsap.set(brk, { scale: 1.35, opacity: 0, transformOrigin: '50% 50%' });
            return gsap.timeline()
              .to(disc, { scale: 1, duration: 0.5, ease: 'back.out(2)' })
              .to([body, head], { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'power3.out' }, '>-0.2')
              .to(brk, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' }, '>-0.25');
          },
          (li: HTMLElement) => { // Step 5
            const disc = li.querySelector('.s5disc');
            const ck = li.querySelector('.s5ck');
            gsap.set(disc, { scale: 0, transformOrigin: '50% 50%' });
            gsap.set(ck, { strokeDashoffset: 1 });
            return gsap.timeline()
              .to(disc, { scale: 1, duration: 0.5, ease: 'back.out(2.6)' })
              .to(ck, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, '>-0.1');
          }
        ];

        const INKS = ['#2B34F0', '#FF6FA8', '#35CDB2', '#FFB81C', '#14123A'];
        function triggerBurst(num: HTMLElement) {
          for (let i = 0; i < 14; i++) {
            const d = document.createElement('i');
            d.className = 'burst';
            d.style.background = INKS[i % INKS.length];
            d.style.position = 'absolute';
            d.style.left = '50%';
            d.style.top = '50%';
            d.style.width = '9px';
            d.style.height = '9px';
            d.style.margin = '-4.5px 0 0 -4.5px';
            d.style.borderRadius = '50%';
            d.style.pointerEvents = 'none';
            num.appendChild(d);
            const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
            const dist = 44 + Math.random() * 40;
            gsap.fromTo(d, { x: 0, y: 0, scale: 0.4 + Math.random() * 0.8, opacity: 1 },
              { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, scale: 0, opacity: 0, duration: 0.9 + Math.random() * 0.3, ease: 'power3.out', onComplete: () => d.remove() });
          }
        }

        steps.forEach((li, i) => {
          const num = li.querySelector('.step__num') as HTMLElement;
          const ring = li.querySelector('.step__ring') as HTMLElement;
          const artTl = stepArts[i](li as HTMLElement);
          
          const tl = gsap.timeline({ paused: true })
            .fromTo(num, { scale: 0.82 }, { scale: 1, duration: 0.7, ease: 'back.out(3.4)' }, 0)
            .fromTo(ring, { scale: 1, opacity: 0.6 }, { scale: 2.3, opacity: 0, duration: 0.85, ease: 'power2.out' }, 0)
            .add(artTl, 0.12);

          let armed = false;
          ScrollTrigger.create({
            trigger: num,
            start: 'center ' + LINE,
            invalidateOnRefresh: true,
            onEnter: () => { 
              li.classList.add('is-on'); 
              tl.timeScale(1).play();
              if (i === steps.length - 1 && !armed) {
                armed = true;
                triggerBurst(num);
              }
            },
            onLeaveBack: () => { 
              li.classList.remove('is-on'); 
              tl.timeScale(1.6).reverse(); 
              armed = false;
            }
          });
        });

        // Drifting discs in How it works section
        gsap.to('.how__disc--pink', { 
          y: -50, 
          ease: 'none', 
          scrollTrigger: { trigger: '#how', start: 'top bottom', end: 'bottom top', scrub: true } 
        });
        gsap.to('.how__disc--mint', { 
          y: 36,  
          ease: 'none', 
          scrollTrigger: { trigger: '#how', start: 'top bottom', end: 'bottom top', scrub: true } 
        });
      }

      // 7. Lock Animation
      gsap.set('.lock__shackle', { y: -3.5 });
      gsap.to('.lock__shackle', {
        y: 0, duration: 0.7, ease: 'bounce.out',
        scrollTrigger: { trigger: '#privacy', start: 'top 92%', once: true }
      });

      // 8. Edit Call-out Reveal
      gsap.fromTo('#edit', { y: 36, rotate: -2, opacity: 0 }, { 
        y: 0, rotate: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.5)', clearProps: 'transform',
        scrollTrigger: { trigger: '#edit', start: 'top 90%', once: true } 
      });

      // 9. Footer Sun Drift
      gsap.fromTo('.foot__disc', { y: -28 }, {
        y: 36, ease: 'none',
        scrollTrigger: { trigger: '#foot', start: 'top bottom', end: 'bottom bottom', scrub: true }
      });

      // 10. Buttons Reveal
      gsap.fromTo('.foot__actions .btn', { y: 24, scale: 0.94, opacity: 0 }, { 
        y: 0, scale: 1, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'back.out(1.8)', clearProps: 'transform',
        scrollTrigger: { trigger: '.foot__actions', start: 'top 94%', once: true } 
      });

      // Layout shifts once fonts arrive
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
      window.addEventListener('load', () => ScrollTrigger.refresh());

      // Cleanup & Refresh
      ScrollTrigger.refresh();
      // @ts-ignore
      window.__sambhavAnimReady = true;
    }, rootRef);

    return () => {
      clearTimeout(timeoutId);
      ctx.revert();
      root.classList.remove('js-anim');
    };
  }, []);

  const formatText = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
  };

  const domainColorClasses: Record<string, 'blue' | 'sun' | 'pink' | 'mint'> = {
    management: 'blue',
    documentation: 'sun',
    'pr-marketing': 'pink',
    sponsorship: 'mint',
    design: 'blue',
    decoration: 'pink',
    technical: 'sun',
    media: 'mint',
  };

  return (
    <div className={`app-shell app ${!registrationIsOpen ? 'is-closed' : ''}`} ref={rootRef} id="app">
      <div className="progress" aria-hidden="true"><i className="progress__bar"></i></div>

      <header className="hero">
        <div className="topbar">
          <Link className="brand" to="/" aria-label="Sambhav 4.0 home">
            <svg className="brand__mark" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="a" cx="13" cy="18" r="12"/>
              <circle className="b" cx="23" cy="18" r="12"/>
            </svg>
            {FEST_NAME}
          </Link>
          <span className="pill" id="status-pill">
            <span className="pill__dot" style={{ background: registrationIsOpen ? 'var(--mint)' : 'var(--pink)' }}></span>
            <span id="status-text">{registrationIsOpen ? 'Registration open' : 'Registration closed'}</span>
          </span>
        </div>

        <GlobalBanners />

        <div className="hero-art" id="hero-art" aria-hidden="true">
          <span className="disc disc--sun"></span>
          <span className="disc disc--pink"></span>
          <span className="disc disc--mint"></span>
          <svg className="glyph-svg" viewBox="-50 -790 2004 824" focusable="false">
            <path className="gp" d="M697 -560V-540H597V0H457V-262H107V-258Q158 -251 190 -224Q222 -197 234.5 -164.5Q247 -132 256 -100Q265 -68 280.5 -46.5Q296 -25 320.5 -25Q345 -25 360 -34L366 -20Q334 4 271.5 4Q209 4 168.5 -20.5Q128 -45 110.5 -81Q93 -117 82 -154Q53 -247 6 -260V-280H37Q175 -280 175 -407Q175 -540 52 -540H-20V-560ZM457 -282V-540H206Q258 -528 285.5 -492.5Q313 -457 313 -407Q313 -318 213 -282Z"/>
            <path className="gp gp--dot" d="M575 -740Q595 -720 595 -691Q595 -662 575 -642.5Q555 -623 527 -623Q499 -623 479 -642.5Q459 -662 459 -691Q459 -720 479 -740Q499 -760 527 -760Q555 -760 575 -740Z"/>
            <path className="gp" d="M1320 -560V-540H1220V0H1080V-312H976Q972 -209 932 -157Q892 -105 825 -105Q775 -105 742.5 -133Q710 -161 710 -211.5Q710 -262 746 -293.5Q782 -325 838 -330V-337Q838 -443 824.5 -481.5Q811 -520 782 -520Q762 -520 747.5 -503.5Q733 -487 731 -456L712 -457Q713 -506 745 -534.5Q777 -563 829 -563Q977 -563 977 -337V-331H1080V-540H1012V-560ZM777 -160Q833 -160 838 -309Q791 -305 763.5 -277.5Q736 -250 736 -210Q736 -188 747 -174Q758 -160 777 -160Z"/>
            <path className="gp" d="M1884 -560V-540H1784V0H1645V-140Q1630 -112 1592.5 -92Q1555 -72 1511 -72Q1437 -72 1386 -120Q1335 -168 1335 -262.5Q1335 -357 1385.5 -406.5Q1436 -456 1510 -456Q1565 -456 1599 -424L1588 -411Q1573 -420 1558 -420Q1526 -420 1505.5 -380.5Q1485 -341 1485 -273Q1485 -124 1573 -124Q1601 -124 1621.5 -146.5Q1642 -169 1645 -193V-540H1280V-560Z"/>
          </svg>
          <span className="sticker" id="sticker">4.0</span>
        </div>

        <div className="hero-copy">
          <h1>You’re on the team.</h1>
          <p className="lead">Register your details once for {FEST_NAME}. It takes about 3 minutes.</p>
          <a className="btn btn--ink" id="cta" href="#domains">
            <span id="cta-text">{registrationIsOpen ? 'Choose your domain' : 'See the domains'}</span>
            <svg className="bob" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v16M5 13l7 7 7-7"/></svg>
          </a>
          <p className="meaning">Sambhav (<span lang="hi">संभव</span>) means “possible”.</p>
        </div>
      </header>

      <main id="main">
        <section className="sec" aria-labelledby="ready-h">
          <h2 className="sec__title" id="ready-h">Keep these ready</h2>
          <ul className="ready" id="ready">
            {CHECKLIST_ITEMS.map((item, i) => (
              <li key={i}>
                <label className="check">
                  <input
                    className="check__input"
                    type="checkbox"
                    checked={checklist[i]}
                    onChange={() => toggleCheck(i)}
                  />
                  <span className="tick" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14123A" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={1} /></svg>
                  </span>
                  <span className="check__text">{formatText(item)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="ready__done" id="ready-done" aria-live="polite">Got everything?
            <a href="#domains">Pick your domain
              <svg className="bob" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v16M5 13l7 7 7-7"/></svg>
            </a>
          </p>
        </section>

        <section className="sec" id="domains" aria-labelledby="domains-h">
          <h2 className="sec__title" id="domains-h">Pick your domain</h2>
          <p className="sec__hint">Tap the domain you were recruited into. If your domain head shared a direct link, use that instead.</p>

          <div className="tiles">
            {DOMAINS.map((domain, i) => (
              <DomainCard
                key={domain.slug}
                domain={domain}
                registrationOpen={registrationIsOpen}
                isWide={i === 0 || i === DOMAINS.length - 1}
                colorClass={domainColorClasses[domain.slug]}
              />
            ))}
          </div>
        </section>

        <section className="sec how" id="how" aria-labelledby="how-h">
          <div className="how__bg" aria-hidden="true"><span className="how__disc how__disc--pink"></span><span className="how__disc how__disc--mint"></span></div>
          <h2 className="sec__title" id="how-h">How it works</h2>

          <div className="steps-wrap" id="steps-wrap">
            <div className="steps__track" id="steps-track" aria-hidden="true">
              <i className="steps__rail"></i><i className="steps__fill" id="steps-fill"></i><i className="steps__head" id="steps-head"></i>
            </div>

            <ol className="steps">
              <li className="step">
                <span className="step__num" aria-hidden="true">1<i className="step__ring"></i></span>
                <div className="step__body"><h3>Choose your domain</h3><p>Pick the team you joined from the tiles above.</p></div>
                <svg className="step__art" viewBox="0 0 48 48" aria-hidden="true">
                  <rect className="s1a" x="4"  y="4"  width="18" height="18" rx="6" fill="#2B34F0"/>
                  <rect className="s1a" x="26" y="4"  width="18" height="18" rx="6" fill="#FFB81C"/>
                  <rect className="s1a" x="4"  y="26" width="18" height="18" rx="6" fill="#FF6FA8"/>
                  <rect className="s1a" x="26" y="26" width="18" height="18" rx="6" fill="#35CDB2"/>
                  <rect className="s1sel" x="1.5" y="23.5" width="23" height="23" rx="8" fill="none" stroke="#14123A" strokeWidth="2.5"/>
                </svg>
              </li>
              <li className="step">
                <span className="step__num" aria-hidden="true">2<i className="step__ring"></i></span>
                <div className="step__body"><h3>Verify your name</h3><p>Type your name as it appears on the team list. We’ll check you’re on the roster.</p></div>
                <svg className="step__art" viewBox="0 0 48 48" aria-hidden="true">
                  <rect x="3" y="14" width="42" height="20" rx="10" fill="none" stroke="#14123A" strokeWidth="2.5"/>
                  <path className="s2type" pathLength={1} d="M12 24h15" fill="none" stroke="#14123A" strokeWidth="3" strokeLinecap="round" strokeDasharray={1} />
                  <circle className="s2ok" cx="37" cy="24" r="5.5" fill="#35CDB2"/>
                  <path className="s2okc" pathLength={1} d="M34.4 24.2l1.9 1.9 3.5-3.9" fill="none" stroke="#14123A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} />
                </svg>
              </li>
              <li className="step">
                <span className="step__num" aria-hidden="true">3<i className="step__ring"></i></span>
                <div className="step__body"><h3>Fill in your details</h3><p>Roll number, year, branch, phone and email.</p></div>
                <svg className="step__art" viewBox="0 0 48 48" aria-hidden="true">
                  <rect x="4" y="8"  width="40" height="9" rx="4.5" fill="#DDE0F2"/><rect className="s3bar" x="4" y="8"  width="40" height="9" rx="4.5" fill="#2B34F0"/>
                  <rect x="4" y="21" width="40" height="9" rx="4.5" fill="#DDE0F2"/><rect className="s3bar" x="4" y="21" width="28" height="9" rx="4.5" fill="#FF6FA8"/>
                  <rect x="4" y="34" width="40" height="9" rx="4.5" fill="#DDE0F2"/><rect className="s3bar" x="4" y="34" width="34" height="9" rx="4.5" fill="#FFB81C"/>
                </svg>
              </li>
              <li className="step">
                <span className="step__num" aria-hidden="true">4<i className="step__ring"></i></span>
                <div className="step__body"><h3>Add a photo</h3><p>A clear, front-facing photo. You can crop it right in the browser.</p></div>
                <svg className="step__art" viewBox="0 0 48 48" aria-hidden="true">
                  <defs><clipPath id="s4clip"><circle cx="24" cy="24" r="17"/></clipPath></defs>
                  <circle className="s4disc" cx="24" cy="24" r="17" fill="#FFB81C"/>
                  <g clipPath="url(#s4clip)"><circle className="s4head" cx="24" cy="20" r="6.5" fill="#14123A"/><path className="s4body" d="M9 42c1.5-8 8-11 15-11s13.500 3 15 11Z" fill="#14123A"/></g>
                  <g className="s4brk" fill="none" stroke="#14123A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11V6a3 3 0 0 1 3-3h5"/><path d="M37 3h5a3 3 0 0 1 3 3v5"/><path d="M45 37v5a3 3 0 0 1-3 3h-5"/><path d="M11 45H6a3 3 0 0 1-3-3v-5"/>
                  </g>
                </svg>
              </li>
              <li className="step">
                <span className="step__num" aria-hidden="true">5<i className="step__ring"></i></span>
                <div className="step__body"><h3>Review and submit</h3><p>Check everything, then confirm. You’ll land on a confirmation page.</p></div>
                <svg className="step__art" viewBox="0 0 48 48" aria-hidden="true">
                  <circle className="s5disc" cx="24" cy="24" r="19" fill="#FFB81C"/>
                  <path className="s5ck" pathLength={1} d="M15 25l6.500 6.500L33 18" fill="none" stroke="#14123A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} />
                </svg>
              </li>
            </ol>
          </div>
        </section>

        <section className="sec" aria-labelledby="faq-h">
          <h2 className="sec__title" id="faq-h">Questions</h2>
          <div className="faq" id="faq">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} id={`faq-item-${i}`}>
                <summary onClick={(e) => handleFaqClick(i, e)}>
                  {item.q}
                  <span className="faq__icon" aria-hidden="true"></span>
                </summary>
                <div className="faq__body">
                  <p className="faq__a">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <aside className="edit" id="edit" aria-labelledby="edit-h">
          <h2 id="edit-h">Already registered?</h2>
          <p>If something needs to change, ask for an edit. A core team member reviews it first.</p>
          <Link className="btn btn--line" to="/request-edit">Request an edit</Link>
        </aside>

        <p className="privacy" id="privacy">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path className="lock__shackle" d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>
          Your details are visible only to the {FEST_NAME} core team.
        </p>
      </main>

      <footer className="foot" id="foot">
        <span className="foot__disc" aria-hidden="true"></span>
        <h2>Need a hand?</h2>
        <p>Can’t find your name, or something won’t load? Message the core team and we’ll sort it out.</p>
        <div className="foot__actions">
          {settings?.help_whatsapp_url && (
            <a className="btn btn--sun" href={settings.help_whatsapp_url} target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/></svg>
              Message on WhatsApp
            </a>
          )}
          {settings?.help_email && (
            <a className="btn btn--line" href={`mailto:${settings.help_email}`}>Send an email</a>
          )}
          {!settings?.help_whatsapp_url && !settings?.help_email && (
            <p style={{ opacity: 0.8 }}>Please ask your domain lead.</p>
          )}
        </div>
        <div className="foot__base">
          <span>{FEST_NAME} team registration</span>
          <Link to="/admin/login">Admin</Link>
        </div>
              <p className="foot__credit">
        Built with <span aria-hidden="true">♥</span> by{' '}
        <Link to="/creator">Vedant Darange</Link>
      </p>
      </footer>
    </div>
  );
}
