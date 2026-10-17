# Sambhav 4.0 · Port the Register flow to the new design

**Audience:** an AI coding agent working inside the real React + Vite + TypeScript repo.
**Source of truth for the look:** `register.html` (a single-file, tappable mockup; open it in a browser first, tap "Preview states" bottom-right to see every state).
**Source of truth for behaviour:** the existing React code. **Do not change behaviour.** This is a re-skin plus a small, listed set of markup additions.

If anything in this plan contradicts the existing logic, the existing logic wins. Stop and ask rather than guess.

---

## 0. Ground rules (read twice)

1. **Logic is frozen.** Keep every hook, state variable, API call, zod schema, error code, retry loop, draft save, honeypot, router navigation and `sessionStorage` write exactly as is. You change JSX structure, class names, CSS and copy only where this plan says so.
2. **The mockup is a visual spec, not code to paste.** `register.html` contains throw-away demo logic (`DO`, `S`, `setupDev`, fake `wait()` timers, the `Preview states` panel, toast, link interception, CSS-variable crop emulation). None of that is ported. Section 14 lists every mockup-only thing.
3. **Fail open.** Nothing may be hidden by CSS waiting on JavaScript. Animations are decoration: if GSAP fails to load or the user prefers reduced motion, every element must already be visible and usable.
4. **Work on a branch, commit per phase** (Section 12). After each phase `npm run build` (or `tsc --noEmit && vite build`) and `npm run lint` must pass, and the app must still register a test member end to end.
5. **Do not touch** `src/lib/*`, `src/hooks/*`, `src/contexts/*`, the Supabase SQL, RLS, or any Admin pages in this task.
6. **Files you have not been shown must be read before editing**: `Success.tsx`, `Banner.tsx` (`GlobalBanners`), `HelpFooter.tsx`, `config.ts`, `App.tsx`/router, `lib/errors.ts`, `lib/photo.ts`, `main.tsx`, `tailwind.config.*`, `package.json`. This plan describes how to treat them; verify against the real code.

---

## 1. What exists today (verified from the code)

| Thing | Current implementation |
|---|---|
| Styling | One global `src/index.css`: Tailwind directives, CSS variables (`--color-primary` etc.), plain BEM-ish classes (`.btn`, `.field`, `.input`, `.select`, `.infobox`, `.stepper__*`, `.wizard-card`, `.wizard-step__*`, `.result-panel`, `.photo-*`, `.cropper-*`, `.review-card*`, `.confirm-checkbox*`, `.success-*`). Fonts: Space Grotesk + Inter via a Google `@import`. |
| Layout | `.page > header.site-header + GlobalBanners + main.container > (register-header, Stepper, .wizard-card > step) + HelpFooter` |
| Register.tsx | `Step1`, `Step2` (react-hook-form + zod), `Step4` (review + submit), main wizard with `useDraft`, `useParams`, invalid-slug page. Step 3 is `PhotoStep`. |
| PhotoStep.tsx | modes `select / processing / crop / ready`, `react-easy-crop`, lucide icons, `validateAndPreparePhoto`, `getCroppedImg`, `formatFileSize`. |
| Shared components | `Stepper` (ol of `li.stepper__step--{done,active,upcoming}`), `Field` (render-prop, `useId`, hint/error), `InfoBox` (`info/warning/success/error`, role note/alert), `GlobalBanners`, `HelpFooter`. |
| Known inconsistencies in the repo | `EditDetails.tsx`/`RequestEdit.tsx` use `className="field__input"` and `btn--secondary`, neither of which exists in `index.css`. `Step4` sets `aria-describedby="submit-error"` but no element has that id. Both are fixed in this plan where they touch Register; the edit pages are a separate task. |

---

## 2. The new design in one paragraph

A riso-print poster. Flat inks (blue, sun yellow, pink, mint) that overprint using `mix-blend-mode: multiply`; asymmetric corner radii (three big corners, one small); dashed rules; sticker-style pills; big, friendly rounded inputs that get a **sun-yellow offset shadow on focus** (like a misregistered print). The page is a 430 px max-width mobile column. The top of the page is a **domain "poster band"** whose colour depends on the domain (`data-tone`), with the stepper card overlapping its bottom edge. Actions (`Back` / `Continue`) are **sticky at the bottom** of the viewport. Display font (Rozha One) is used only for the big numerals in the year picker; everything else is Bricolage Grotesque.

---

## 3. Mockup anatomy → React mapping

`register.html` has two `.app` roots: `#wizard` (header band, banners, stepper, four steps, "bad link" page, footer) and `#success`.

| Mockup element | Becomes | Notes |
|---|---|---|
| `<div class="app" data-tone>` | root of `Register` page (and `Success`) | needs `container-type: inline-size` for `cqw` units. See 6.2 |
| `header.band` | new component `DomainBand` | replaces `.site-header`, `DomainBadge` and the "Change domain" row |
| `.banners` (closed / offline / in-app / draft) | restyle `GlobalBanners` | logic stays in `Banner.tsx`; see 7.4 |
| `nav.stepper` | restyle `Stepper.tsx` | same props, same `ol/li`; see 7.2 |
| `#s1` | `Step1` | same state machine |
| `#s2` / `form#f2` | `Step2` | same react-hook-form wiring |
| `#s3` | `PhotoStep` | same modes; keep `react-easy-crop` |
| `#s4` | `Step4` | same submit flow |
| `#bad` | the invalid-slug branch of `Register` | |
| `.startover` | the existing "Start over" button | |
| `footer.foot` | restyle `HelpFooter` | |
| `#success` | `Success.tsx` | see Section 9 |
| `details.dev`, `.toast`, script | **not ported** | Section 14 |

New small components to create: `DomainBand`, `StickyActions`, `DomainSprite` (the inline SVG `<symbol>` set), `useStepEnter` (optional animation hook). Everything else is edits to existing files.

---

## 4. Strategy: scope the new theme so nothing else breaks

Home, RequestEdit, EditDetails and the Admin pages share class names (`.btn`, `.field`, `.input`, `.infobox`…) with the Register flow. Restyling those globally would instantly change pages that have not been designed yet and may break them.

**Therefore: scope the new styles under a root class `.riso`.**

- New file `src/styles/riso.css`, wrapped in a single native-nesting block `.riso { … }` (Vite/esbuild/Lightning CSS handle nesting; if the build target is old, run `postcss-nested` instead).
- Because every selector becomes `.riso .btn`, it out-ranks the legacy `.btn` and no legacy rule needs deleting.
- Only the pages migrated so far wear `.riso`. When **every** page is migrated, a later cleanup task removes the scope and deletes the legacy CSS.
- The CSS custom properties from the mockup (`--paper`, `--ink`, `--blue`, `--sun`, `--pink`, `--mint`, `--berry`, `--gutter`, fonts…) are declared **on `.riso`**, not `:root`, so they cannot leak.
- `html`, `body`, `*` reset rules from the mockup are **not copied**. The legacy global reset in `index.css` already exists. Inside `.riso` add only `.riso, .riso * , .riso *::before, .riso *::after { box-sizing: border-box; }`.

Shell markup for each migrated page:

```tsx
<div className="riso-shell">                 {/* full-width paper-deep background behind the column */}
  <div className="riso app" data-tone={tone}> {/* the 430px column */}
    …page…
  </div>
</div>
```

`.riso-shell { background: #DDE0F2; min-height: 100dvh; }` (global, tiny, not nested).

---

## 5. Phase 0 · Preparation (no visual change yet)

1. `git switch -c feat/riso-register`.
2. Read all files listed in rule 6 and in Section 1. Write down (in the PR description) any place where reality differs from this plan.
3. **Fonts.** Add to `index.html` `<head>`:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Rozha+One&display=swap" rel="stylesheet">
   <meta name="theme-color" content="#ECEEF8">
   ```
   Leave the Space Grotesk/Inter `@import` in `index.css` untouched (other pages still use it). Optional later: self-host with `@fontsource/bricolage-grotesque` (weights 400–800) and `@fontsource/rozha-one`.
4. **Animation dependency (optional polish).** `npm i gsap@3.15.0`. Do not add anime.js or ScrollTrigger here; the register flow only needs `gsap` core.
5. **Domain config.** In `config.ts`, extend each entry of `DOMAINS` (keep existing `slug`, `name`, `color`, `icon` fields untouched; other pages use them):
   ```ts
   export type Tone = 'blue' | 'sun' | 'pink' | 'mint';
   // add to each domain object:  tone: Tone;   glyph: string  // glyph === slug, used as #g-<slug>
   ```
   | slug | tone |
   |---|---|
   | management | blue |
   | design | blue |
   | documentation | sun |
   | technical | sun |
   | pr-marketing | pink |
   | decoration | pink |
   | sponsorship | mint |
   | media | mint |

   Confirm the real slugs in `config.ts`; if they differ from the table, use the real ones and keep this tone grouping.
6. **SVG sprite.** Create `src/components/DomainSprite.tsx` that renders the `<svg width="0" height="0" style={{position:'absolute'}} aria-hidden focusable="false"><defs>…</defs></svg>` containing:
   - the 8 `g-<slug>` symbols copied verbatim from `register.html` `<defs>`;
   - the icon symbols `i-arrow-r, i-arrow-l, i-check, i-x, i-alert, i-camera, i-image, i-rotate, i-reset, i-lock, i-wa, i-zoom-out, i-zoom-in, i-scissors`.
   Render `<DomainSprite />` **once**, in `App.tsx` above the router outlet. Usage: `<svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>`.
   - lucide-react icons in `PhotoStep` may stay, but the sprite icons match the stroke weight of the design (2.4). Prefer the sprite; if you keep lucide, pass `strokeWidth={2.4}` and `size={18}`.

---

## 6. Phase 1 · Tokens and primitives (`src/styles/riso.css`)

### 6.1 How to build the file
Open `register.html`, copy the contents of its first `<style>` block **except** the section headed `PREVIEW-ONLY (delete when porting)` and except the `html`/`body`/`*`/`.skip`/`.sr` global rules. Paste inside `.riso { … }`. Then apply the renames/decisions below. Import it from `index.css` **after** the Tailwind directives:

```css
@tailwind base; @tailwind components; @tailwind utilities;
@import './styles/riso.css';   /* if using @import, it must be the first rule in the file; otherwise import it in main.tsx after './index.css' */
```
Simplest: `import './styles/riso.css'` in `main.tsx` after `import './index.css'`.

### 6.2 Things that must be exactly right
- `.riso.app { container-type: inline-size; max-width: 430px; margin-inline: auto; min-height: 100dvh; background: var(--paper); overflow-x: clip; position: relative; }`
  - `overflow-x: clip`, **not** `hidden`. `hidden` turns the column into a scroll container and silently breaks `position: sticky` on the action bar.
  - The `cqw` units in the band discs, Success discs and headline sizes **require** the container-type. Keep it on the same element that carries `.riso`.
- **Containment pitfall:** `container-type: inline-size` makes the element a containing block for `position: fixed` descendants. Any toast/modal/overlay must be rendered with a React portal into `document.body`, outside `.riso`.
- `100svh` in the mockup → use `100dvh` (matches the existing `.page`).
- Keep every `@media (prefers-reduced-motion: reduce)` rule; scope it as `.riso *` etc.
- Input font-size must stay **≥ 16px** (prevents iOS focus-zoom). All mockup inputs are 17px.
- Tap targets ≥ 44px: `.btn` is 54px (`.btn--sm` 46px), `.tab`/`.yr__box` ≥ 46px. Do not reduce.

### 6.3 Class-name mapping (old → new)
Keep **old JSX class names working** for non-migrated pages by not deleting legacy CSS. In migrated components use the new names:

| Old (legacy) | New (inside `.riso`) | Notes |
|---|---|---|
| `.page`, `.page--register` | `.riso-shell > .riso.app` | |
| `.site-header*`, `.register-header`, `.domain-badge*` | `.band`, `.band__top`, `.chip`, `.brand`, `.band__eyebrow`, `.band__title`, `.band__change` | `DomainBand` |
| `.container`, `.register-container` | none (padding comes from `.step`) | |
| `.wizard-card` | none (removed; the page is the card) | |
| `.wizard-step`, `.wizard-step__title/desc` | `section.step`, `.eyebrow`, `.h2`, `.desc` | |
| `.wizard-step__actions` | `.actions` (+ `.btn--main` on the primary) | sticky, see 7.6 |
| `.btn--primary` | `.btn--ink` (default), `.btn--blue` (final Submit / Use this photo) | |
| `.btn--ghost` | `.btn--ghost` (now white pill) | same name |
| `.btn--secondary` | `.btn--line` | |
| `.btn--lg/sm/xs` | `.btn--sm` only; `lg` and `xs` removed | |
| `.link` | `.linkbtn` for `<button>`; plain `a` underline | |
| `.field`, `.field__label/hint/error/required` | `.field`, `.label`, `.hint`, `.err`, `.req` | `Field.tsx` changes, see 7.3 |
| `.input`, `.input--error` | `.input` inside `.control`; error is `.field--err` on the wrapper | |
| `.select` | `.select-wrap > select.select` | custom chevron is a pseudo-element on the wrapper |
| `.year-chips/.year-chip*` | `.yrs > label.yr > input + .yr__box` | |
| `.email-suggestion` | `.sugg` | |
| `.result-panel*` | `.result`, `.result--bad/warn/ok/closed`, `.checks` | |
| `.infobox*` | `.note`, `.note--warn/err/ok` | `InfoBox.tsx`, see 7.5 |
| `.stepper*` | `.stepper`, `.st`, `.st--active/done`, `.st__dot/lbl`, `.stepper__fill` | 7.2 |
| `.photo-*`, `.cropper-*` | `.rules/.rule`, `.photo-actions`, `.crop*`, `.zoomrow`, `.toolrow`, `.previews`, `.idc`, `.readybar`, `.readyacts` | 8.3 |
| `.review-card*` | `.rev`, `.rev__head`, `.rev__row`, `.rev__k/v/edit` | 8.4 |
| `.confirm-checkbox*` | `.confirm` + `.tick` | 8.4 |
| `.privacy-note` | `.privacy` | |
| `.spinner` | `.spin` (two overprinting dots) | |
| `.register-startover` | `.startover` | |
| `.sr-only` | keep legacy `.sr-only` | do not rename |

### 6.4 Domain tone variables
Copy the four `[data-tone="…"]` blocks. They set `--d-bg, --d-fg, --d-a, --d-b` used by the band, the review header, the ID-card preview and the Success pass. Put `data-tone={DOMAIN_MAP[slug].tone}` on `.riso.app`. For the unknown-slug page use `data-tone="blue"`.

---

## 7. Phase 2 · Shared components

### 7.1 `DomainBand.tsx` (new)
```tsx
interface Props { slug?: string; name?: string; eyebrow?: string; title?: string; showChange?: boolean }
```
Markup (copy structure from `header.band`):
```
header.band
  i.bd.bd--a  i.bd.bd--b           (aria-hidden decorative discs)
  svg.band__mark > use href="#g-<slug>"   (big faint glyph, hidden when unknown slug)
  .band__top
    a.chip[href="/"][aria-label="Back to home"]  →  react-router <Link to="/">  ← arrow-l + "Home"
    a.brand[href="/"]  logo svg (two circles) + "Sambhav 4.0"
  p.band__eyebrow  "Registering for"
  h1.band__title   {domain name}   (+ class is-long when name.length > 11)
  <Link to="/" className="band__change" aria-label="Change domain">Change domain</Link>
```
Rules:
- The page's only `<h1>` is the band title (previously there was no h1 in Register). Step titles stay `h2`.
- Replace `<Link to="/" … ← Back>` in the old header and the `DomainBadge` + "Change domain" row. Delete `DomainBadge` from `Register.tsx` once unused.
- `.band` must have `isolation: isolate` and the discs `z-index: -1` so the multiply blend does not bleed into the page behind it.
- The brand mark circles: blue + sun with multiply on the home page; inside the band they become ink + white (`.band .brand .a/.b` rules in the CSS). Copy those rules.

### 7.2 `Stepper.tsx` (restyle, minimal markup change)
Keep props `{ steps, currentStep }`, the `nav[aria-label]`, `ol`, `li[aria-current="step"]`. Change only:
- classes: `stepper__step--upcoming` → no modifier (the mockup has `.st`, `.st--active`, `.st--done`);
- wrap the list in `div.stepper__track` and add two decorative siblings before the `ol`: `<i className="stepper__line" aria-hidden="true" />` and `<i className="stepper__fill" aria-hidden="true" style={{ ['--p' as string]: (currentStep - 1) / (steps.length - 1) }} />`;
- bubble → `.st__dot`; label → `.st__lbl`;
- done icon: use `<svg viewBox="0 0 24 24"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>` so the check can draw itself (`stroke-dasharray: 1` + CSS `@keyframes draw`).
- Remove the per-step `::after` connector lines of the legacy CSS (they are scoped away anyway).
- Because `.riso .stepper` is positioned with a negative top margin it overlaps the band: **render `<Stepper>` directly after the banners, as a sibling of `DomainBand`**, not inside `main`.
- The stepper must not render on the invalid-slug page.
- Make the fill reduce motion: `transition: width .6s` is already inside the reduced-motion rule.

### 7.3 `Field.tsx` (extend, keep contract)
The render-prop contract `children({ id, 'aria-describedby', 'aria-invalid' })` and `useId` stay. Add **optional** props, all defaulting to current behaviour:

```tsx
interface FieldProps {
  label: string; hint?: string; error?: string; required?: boolean;
  optional?: boolean;      // renders <span className="opt">Optional</span> instead of the red asterisk
  valid?: boolean;         // adds .is-valid on the wrapper → green tick appears
  prefix?: string;         // e.g. "+91": renders <span className="pre" aria-hidden>
  children: …; className?: string;
}
```
Rendered structure (note the new `.control` wrapper):
```tsx
<div className={cx('field', error && 'field--err', valid && 'is-valid', className)}>
  <label htmlFor={id} className="label">{label}{required && <span className="req" aria-hidden="true"> *</span>}{optional && <span className="opt">Optional</span>}</label>
  {hint && <p id={hintId} className="hint">{hint}</p>}
  <div className="control">
    {prefix && <span className="pre" aria-hidden="true">{prefix}</span>}
    {children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}
    <span className="ok" aria-hidden="true"><svg className="ic"><use href="#i-check"/></svg></span>
  </div>
  {error && <p id={errorId} className="err" role="alert"><svg className="ic" aria-hidden="true"><use href="#i-alert"/></svg><span>{error}</span></p>}
</div>
```
- Inputs rendered inside get class `input` (and `input--pre` when `prefix` is set, `input--roll` for the roll number, which only uppercases visually via CSS; the value is still normalised in code).
- The select is wrapped by the caller: `<div className="select-wrap"><select className="select" …/></div>`. The year picker does not use `.control`; give it a prop `bare` (skip the `.control` wrapper) or render it in a `div.yrs` and accept that `.control` is just a positioning wrapper with `margin-top: 10px` (it is harmless around `.yrs`; prefer the `bare` prop for cleanliness).
- Error shake: the mockup adds `.shake` to `.control` when an error first appears. Implement with a small effect: when `error` changes from falsy to truthy, add the class, remove it on `animationend`. Skip when reduced motion.
- Existing call sites in other pages (`EditDetails`, `RequestEdit`) do not use `Field` or use their own markup, so extending it is safe. Grep for `<Field` before editing.

### 7.4 `Banner.tsx` / `GlobalBanners` (restyle only)
Read it first. The mockup shows up to four banners as rounded cards in a `.banners` wrapper (padding `0 var(--gutter)`), each `.banner` with a coloured `.banner__dot`:
- closed → `.banner--closed` (pink tint): "Registration is closed. If you were selected but haven't registered, message the core team below."
- offline → `.banner--offline` (ink): "You're offline. Your answers are saved on this phone. Reconnect to submit."
- in-app browser → `.banner--inapp` (sun tint): "Open this in Chrome or Safari. Photo upload can be unreliable in this app's browser…" with a Copy link button.
- draft restored (new, see 8.5) → plain `.banner`.
Keep the existing detection logic and dismiss behaviour. Map existing banner kinds (`warning`/`info`/`closed`) to the classes above. Use `role="status"`. The banners are **not sticky** any more (legacy `.global-banners { position: sticky; top: 60px }` is removed inside `.riso` because there is no sticky header). Place `<GlobalBanners />` between `DomainBand` and `Stepper`.

### 7.5 `InfoBox.tsx` (restyle, keep API)
Keep `variant` and `role` logic. Replace the 20×20 SVG icon set with a round marker, so the markup becomes:
```tsx
<div className={`note note--${v}`} role={…}>
  <span className="note__ic" aria-hidden="true">{v === 'info' || v === 'success' ? 'i' : '!'}</span>   {/* success may use a check */}
  <div>{children}</div>
</div>
```
Variant mapping: `info` → `.note` (white), `warning` → `.note--warn`, `success` → `.note--ok`, `error` → `.note--err`. Existing JSX that places `<p>` or lists inside children keeps working.
Note: `RequestEdit.tsx` passes a `style` prop to `InfoBox` which the current component ignores; accept and spread `style`/`className` to the root so that bug disappears.

### 7.6 `StickyActions.tsx` (new, trivial)
```tsx
export function StickyActions({ children }: { children: ReactNode }) { return <div className="actions">{children}</div>; }
```
CSS (already in the mockup): `position: sticky; bottom: 0; display: flex; gap: 10px; margin: 30px calc(var(--gutter) * -1) 0; padding: 18px var(--gutter) calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(to top, var(--paper) 68%, rgba(236,238,248,0));` The primary button gets `.btn--main { flex: 1 }`.
It must be a descendant of the scrolling column and **must not** sit inside an element with `overflow` other than `visible`/`clip`.

### 7.7 `HelpFooter.tsx` (restyle)
Replace with the `.foot` block: blue footer, sun disc (`.foot__disc`), `h2 "Need a hand?"`, one sentence, and action buttons (`Message on WhatsApp` as `.btn--sun .btn--sm`, `Send an email` as `.btn--line .btn--sm`). Keep the existing data source (`settings.help_whatsapp_url`, help email). **Hide any action whose value is empty.** If both are empty, render the text "Please ask your domain lead." in place of the buttons. Keep `href` building identical to today.

---

## 8. Phase 3 · The wizard

### 8.1 `Register.tsx` page shell
Target structure:
```tsx
<div className="riso-shell">
  <div className="riso app" data-tone={domainConfig.tone}>
    <DomainBand slug={domainSlug} name={domainConfig.name} />
    <GlobalBanners />
    {hadDraftRestored && showDraftBanner && <DraftBanner onStartOver={handleStartOver} />}
    <Stepper steps={WIZARD_STEPS} currentStep={step} />
    <main id="main">
      {step === 1 && <Step1 … />}
      {step === 2 && <Step2 … />}
      {step === 3 && <PhotoStep … fullName={verifiedName} domainName={domainConfig.name} />}
      {step === 4 && step2Data.email && <Step4 … />}
      <p className="startover"><button type="button" className="linkbtn" onClick={handleStartOver}>Start over</button></p>
    </main>
    <HelpFooter />
  </div>
</div>
```
Required refactors that do **not** change behaviour:
- Extract the inline "Start over" onClick body into `const handleStartOver = () => { clearDraft(); setStep(1); … }` (identical statements) and reuse it for the draft banner.
- Remove the `.wizard-card` wrapper.
- Invalid-slug branch: render `riso-shell > riso.app[data-tone=blue] > DomainBand(title="Pick your team", eyebrow="Hmm, that link", no change link) + main > section.step: h2 "That team link isn't right", `.desc` text (unchanged copy), then `.minis` grid of `a.mini[data-tone]` tiles (glyph svg + name) linking to `/register/<slug>` (keep `<a href>`, as today). Copy `.minis`/`.mini` CSS.
- Step change UX: on step change scroll so the stepper top is near the top of the viewport (`window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })`), move focus to the new step's `h2` (`tabIndex={-1}`, `.h2:focus { outline: none }`), and update a visually hidden `aria-live="polite"` region with `Step N of 4: <title>`. Step 1 keeps its existing autofocus-on-mount of the input (do not also focus the h2 on first mount).
- Optional entrance animation (Section 10).

### 8.2 Step 1
Keep the `NameCheckStatus` machine and all texts. Markup/class changes:
- `eyebrow "Step 1 of 4"`, `h2.h2#… tabIndex=-1`, `p.desc` (the domain name in `<b>`), then the info note (`InfoBox variant="info"`, text unchanged).
- Field: use new `Field` (hint stays) with `valid={status==='ok'}`; the input keeps `ref`, `onKeyDown`, `maxLength`, `minLength`, `autoComplete`, `spellCheck`, placeholder, aria attributes. `status==='error' || 'not_found'` ⇒ pass `error` text to `Field` (for `not_found` there is no inline error text today; the red state plus result panel is enough: pass an empty-string-safe flag, i.e. add `field--err` via a new `invalid` prop rather than an error message).
- Result panels, same conditions, new classes:
  - `not_found` → `.result.result--bad[role=alert]` with `h3`, `p`, `ol.checks` (numbered discs via CSS counter), WhatsApp button `a.btn.btn--ink.btn--sm` with the wa icon.
  - `already_registered` → `.result.result--warn`.
  - `closed` → `.result.result--closed` (ink background, sun links).
  - `ok` → `.result.result--ok` with the animated `.bigcheck` (an SVG check with `pathLength="1"`).
  - Network `error` → `InfoBox variant="error"` (same message).
  - **Copy changes:** "✓ Found you…" → drop the "✓" (the big check replaces it), "Great — tap Continue…" → "Great. Tap Continue to fill in your details." (em dash removed), "📱 Report a problem with my name" → drop the emoji, use the wa icon.
- Actions: `StickyActions` with `Link.btn.btn--ghost` Back (arrow-l icon) and the primary `button.btn.btn--ink.btn--main` (arrow-r icon). While `checking`, swap the arrow for `<span className="spin" aria-hidden="true" />` and disable.
- When the result panel appears, smooth-scroll it into view if its bottom is below the sticky bar (mockup `reveal()`), and (optionally) fade it in.

### 8.3 Step 2
Keep `buildStep2Schema`, `useForm`, `register`, `handleSubmit`, the email suggestion effect, `applyEmailSuggestion`, `handleInvalid`. Do not change field names, ids used by `document.getElementById('field-…')` (note: that lookup currently never matches because ids come from `useId`; do not "fix" it here, but you may improve focusing by calling `setFocus(firstErrorKey)` from react-hook-form, which is behaviour-neutral).

Per field:
| Field | Markup |
|---|---|
| Roll number | `Field` + `input.input.input--roll`, hint `As printed on your college ID. Example: ${ROLL_EXAMPLE}` |
| Year | `Field bare` containing `div.yrs[role=radiogroup][aria-label]` with four `label.yr` (see below) |
| Branch | `Field` + `div.select-wrap > select.select` |
| Mobile | `Field prefix="+91"` + `input.input.input--pre[type=tel][inputMode=numeric]` |
| Alternate mobile | same, `optional` instead of `required`; **remove `placeholder="Optional"`** (the "Optional" pill replaces it) |
| Email | `Field` + `input.input` + suggestion box (below) |
| Confirm email | `Field`, hint "Type it again to be sure. Pasting is turned off on purpose." |

Year picker (4 cards, 2×2 grid):
```tsx
<label key={yr} className="yr">
  <input type="radio" value={yr} {...register('year')} {...(yr===1 ? {'aria-describedby': aria['aria-describedby']} : {})} />
  <span className="yr__box">
    <span className="yr__n" aria-hidden="true">{yr}</span>
    <span><span className="yr__t">{YEAR_TITLE[yr]}</span><span className="yr__s">{YEAR_SHORT[yr]}</span></span>
  </span>
</label>
```
where `YEAR_TITLE = {1:'First Year',2:'Second Year',3:'Third Year',4:'Final Year'}` and `YEAR_SHORT = {1:'FE',2:'SE',3:'TE',4:'BE'}`. `YEAR_LABELS` (existing, used in the review and the API payload display) is **not changed**. The visually hidden-but-focusable input is positioned `absolute; inset:0; opacity:0` over the card so taps and keyboard both work; focus ring is on `.yr__box` via `input:focus-visible + .yr__box`.

Email suggestion (`.sugg`): same condition and handler; markup `div.sugg > span "Did you mean <b>…</b>?" + button[type=button] "Fix it"` (pill, ink).

Confirm-email paste block: keep `onPaste={e => e.preventDefault()}`. Optional: also announce `aria-live` text "Pasting is turned off here. Please type it again." (the mockup shows this as a toast; use the sr-only live region instead of building a toast).

Validation timing (enhancement tier, low risk): the mockup validates each field on blur and shows the green tick when valid. To match: `useForm({ mode: 'onTouched' })` and pass `valid={touchedFields.x && !errors.x && !!watch('x')}`. If this changes any existing test, revert to default mode and drop the tick; the design still works without it.

Actions: Back (`button.btn.btn--ghost`) and `button[type=submit].btn.btn--ink.btn--main`; keep the `onClick={handleInvalid}` on submit.

### 8.3b PhotoStep.tsx
Keep: modes, all handlers, refs, object-URL cleanup, `validateAndPreparePhoto`, `getCroppedImg`, `formatFileSize`, the two hidden file inputs (`capture="user"` for camera), error strings, props. **Add two optional props:** `fullName?: string; domainName?: string` (used only by the ID-card preview).

Per mode:
- **Header:** `eyebrow "Step 3 of 4"`, `h2 "Upload your photo"`, `p.desc` (text unchanged). Draft notice and error → `InfoBox` (info / error).
- **select:** `.rules` with two `.rule` cards.
  - DO card: `.badge.badge--do "✓ DO"`, title "A clear ID photo" (was "Clear ID photo"), a 96px illustration thumb on the left and the 4-item list on the right (`ul` with mint bullets).
  - DON'T card: `.badge.badge--dont "✕ DON'T"`, title "Avoid these", a row of three 64px thumbnails with a pink ✕ badge each, then the 4-item list (pink bullets).
  - The thumbnails in the mockup are generated illustrations (`portrait()` function). **Ship static SVG files** instead: `src/assets/photo-rules/{good,shades,group,dark}.svg`, authored as original generic illustrations (flat shapes, no real people, no likeness). The functions `person()`/`portrait()` in `register.html` give you the exact shapes: copy the SVG strings they produce for the four variants (good: mint background; shades: sun background + dark rectangle over the eyes; group: pink background + two figures; dark: ink-soft background + `filter: brightness(.5) blur(1.4px)` applied by CSS). Decorative, `alt=""`.
  - Buttons: `button.btn.btn--ink` Take photo (camera icon) and `button.btn.btn--line` Choose from gallery (image icon), stacked, full width. Format note `p.fmt`: "JPG, PNG, WebP or iPhone HEIC · up to 15 MB · saved as a square 800×800 ID photo" (reworded; same facts).
- **processing:** `div.proc[role=status]` with the two-dot `.orbit` (two overprinting discs rotating) and `processingMsg`.
- **crop:** keep `react-easy-crop`. Viewport: `div.crop` is now square (`aspect-ratio: 1`, replaces the fixed 320px height). Style the library instead of replacing it:
  ```tsx
  <Cropper … cropShape="rect" showGrid
    style={{ cropAreaStyle: { color: 'rgba(20,18,58,.62)', border: '0', borderRadius: 6 } }} />
  ```
  (`react-easy-crop` draws the dim overlay with `box-shadow: 0 0 0 9999em` using the crop area's `color`; changing `color` recolours it.) Corner brackets in sun yellow: give the crop area a `cropAreaClassName="rg-cropArea"` and draw four L-shaped corners with four `linear-gradient` backgrounds in CSS (visual only, no effect on crop maths). Grid lines: keep the library's grid; set `.reactEasyCrop_CropAreaGrid::before/::after { border-color: rgba(255,255,255,.55) }`.
  - Controls: `.zoomrow` (white pill containing zoom-out icon, the range input styled `.slider` with the dashed track and a sun thumb with an ink border, zoom-in icon), `.toolrow` with two `.btn.btn--ghost.btn--sm` (Rotate 90°, Reset).
  - Sticky actions in this mode: `Cancel` (`.btn--ghost`) and `Use this photo` (`.btn--blue.btn--main`, check icon; shows `Processing…` + spinner while `isCropping`).
  - **Do not port** the mockup's `--fx/--fy/--z/--r` CSS variables, `pointerdown` drag code or `crop__img`; they only emulate react-easy-crop in the static mockup.
- **ready:** `.readybar` (`.vchip` "Photo ready" with the mint check + `span.meta` "JPEG · 800×800 px · {size}"), then `.previews` white card containing:
  - circular avatar preview (`.pvbox--circle .pv`, 92px, double ring);
  - ID-card preview `.idc` (rotated −2.5°): coloured top strip (domain tone) "SAMBHAV 4.0 / TEAM", punch-hole pill, 94px rounded-square photo, `fullName` (fallback: omit the element), `domainName`, and a barcode-like stripe made with a repeating gradient. `aria-hidden="true"` on the whole card (it is decorative; the photo already has alt text in the avatar `<img alt="Avatar preview">`).
  - **The preview `<img>`s are plain** `width:100%; height:100%; object-fit:cover` because `previewUrl` is already the cropped 800×800 blob. The mockup's `.pv__img` has a 125% scale + offset only to fake a crop on a sample illustration; do not copy that. In the CSS keep `.pv { position: relative; overflow: hidden; aspect-ratio: 1 }` and `.pv img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover }`.
  - `.readyacts`: Retake, Choose another, and (only if `rawImageSrc`) Adjust crop, all `.btn.btn--ghost`, 42px.
- **Navigation:** sticky `Back` (disabled in processing/cropping) and `Continue` (primary ink, arrow icon; **copy change: "Continue to Review" → "Continue"** because the longer label wrapped on 360px phones). Same disabled conditions as today.

### 8.4 Step 4
Keep `submitLock`, honeypot check, confirmation check, offline check, photo check, upload retries (1 s then 3 s), `onPhotoUploaded`, `submitRegistration` payload, `getError`, error→step mapping, `done` handling. Markup:

- `eyebrow "Step 4 of 4"`, `h2 "Review your details"`, `p.desc`.
- **Review card** `.rev`:
  - `.rev__head` (domain-tone background): circular avatar `.pv` (70px, white ring) using `photoPreviewUrl` (fallback: an initial-letter disc if null), `.rev__who` with `p.rev__name` (the verified name) and `p.rev__dom` (domain name), and a pill button **`Edit photo`** (`.rev__edit.rev__edit--head`, `aria-label="Edit photo"`, `onClick={() => onGoToStep(3)}`). The old "Photo ready ✓ / No photo uploaded" row is dropped; if `!photoBlob && !photoPath` show a small `.note--warn` "No photo uploaded" above the card.
  - Rows (same `reviewRows` array): `.rev__row` = `span.rev__k` (uppercase 12.5px label) + `span.rev__v` + `button.rev__edit` (`aria-label="Edit <label>"`, calls `onGoToStep(row.step)`). Grid `82px 1fr auto`, `overflow-wrap: anywhere` so long emails wrap instead of overflowing.
- Remove the duplicated note ("Note: Your name will be saved exactly…"): the same sentence already appears in the step description. (If you want to keep it, keep it; the mockup omits it.)
- **Confirm checkbox:** `label.confirm` containing the real `<input type="checkbox" id="review-confirm">` (visually hidden but focusable) then `span.tick[aria-hidden]` with an SVG check (`pathLength="1"`, dashoffset animates 1→0 when checked, background turns sun) then the text span. Text unchanged.
- Honeypot: keep exactly `input[type=text][name="website"].honeypot.sr-only[tabIndex=-1][aria-hidden][autoComplete=off]`. Do not restyle or move it out of the DOM; the submit code queries it by name.
- Privacy line `p.privacy` with the lock icon (replace the 🔒 emoji with the sprite icon). Text unchanged.
- **Errors:** render `InfoBox variant="error"` with `id="submit-error"` on the wrapper (this fixes the dangling `aria-describedby`). Keep the "Go back and fix it" button, style it `.linkbtn`. For the "not ticked" error also shake the `.confirm` label.
- **Progress:** replace the two info boxes with `.prog` (`role="status"`): `p.prog__t` = `.spin` + "Uploading your photo…" / "Saving your details…", and a `.prog__bar` whose inner `i` width is set from state: uploading → 55%, saving → 90%, done → 100%, with a CSS width transition. (It is a status indicator, not a measured percentage; do not fabricate upload progress.)
- **Actions:** sticky `Back` (disabled while uploading/saving) and `button#submit-btn.btn.btn--blue.btn--main`. **Copy change: "Submit registration" → "Submit"** (wrapped to two lines at 360px). Loading labels stay "Uploading…" / "Saving…". Keep `aria-describedby={submitError ? 'submit-error' : undefined}`.

### 8.5 Draft-restored banner (small addition)
The existing code computes `hadDraftRestored` but only uses it inside `PhotoStep`. The mockup also shows a banner "We restored what you typed earlier. **Start over**" under the band. Implement `DraftBanner` using `hadDraftRestored` and `handleStartOver`; hide it once the user taps Start over or reaches step 3 (the photo notice takes over). This is the only new piece of UI state, local to `Register`.

---

## 9. Phase 4 · `Success.tsx`

`Success.tsx` was not provided. Read it, keep its data source (router `state` with a `sessionStorage` fallback key `sambhav_success_${domain}`) and its redirect behaviour for missing state. Payload available: `fullName, domainSlug, domainName, registeredAt (ISO), roll, photoUrl`.

Layout (from `#success` in the mockup):
1. Top row: brand only (no Home chip).
2. `.sx__stage`: three overprinting discs (sun, pink, mint) behind a 182px circular photo with a blue progress-ring SVG around it (`circle` with `pathLength="1"`; animates `stroke-dashoffset 1→0`), and a tilted ink "✓ Registered" sticker pill.
3. `h1.sx__title` "You're in!" (word-by-word mask reveal in the animated version; the plain text must be the static fallback).
4. `p.sx__sub`: "Welcome to the **{domainName}** team, **{firstName}**." where `firstName = fullName.split(' ')[0]`.
5. `article.pass` (tilted −1°): domain-tone header with the domain glyph and "TEAM PASS / Sambhav 4.0", a dashed perforation with two punched semicircles, then name, and a `dl` with Domain, Roll number, Registered (format in IST, e.g. `15 Oct 2026, 1:42 PM`, using the existing `lib/dates` helper if there is one).
6. Tip: "Take a screenshot of this page for your records."
7. `.next` card (sun tint): "What happens next" with the existing copy, plus the **Join the {domain} group** button **only if** `config.domainWhatsApp[slug]` (or whatever the existing config key is) is set.
8. "Back to home" (`btn--line`), "Made a mistake? **Request an edit**" (link to `/request-edit`), `HelpFooter` (WhatsApp only).
Photo: use `photoUrl` as the `<img>`; fall back to an initial-letter disc if empty or on `onError`. `alt="Your photo"`.
Keep whatever copy the existing component has for text that the mockup does not mention.

---

## 10. Animation (optional polish; do last)

Principles: decorative only; never gate content; skip when `prefers-reduced-motion: reduce`; always clean up.

Create `src/lib/motion.ts`:
```ts
export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```
Use `gsap.context` inside `useLayoutEffect` and return `ctx.revert()` (React 18 StrictMode runs effects twice in dev; `context.revert()` makes that safe).

1. **Step entrance** (`useStepEnter(ref, direction)`): on mount of each step wrapper: `gsap.fromTo(el, {x: dir*26, opacity:0}, {x:0, opacity:1, duration:.45, ease:'power3.out', clearProps:'transform,opacity'})`, then stagger the `.field, .note, .rules, .rev, .confirm, .previews` children (`y:18→0`, `.55s`, stagger `.05`). Direction = +1 forward, −1 backward (compare to previous step).
2. **Result panels** (step 1): `fromTo(el,{y:14,opacity:0},{y:0,opacity:1,duration:.45})` when they mount.
3. **Success:** a single timeline: discs scale in (stagger .12, `back.out(2)`), photo pops in, ring draws (1.1 s), sticker pops, headline words slide up from `yPercent:115` inside overflow-hidden wrappers (split the text into `<span class="w"><span class="wi">word</span></span>` for animation only; set `aria-label` on the h1 with the original sentence and `aria-hidden` on the split spans), subtitle, pass (rotate in), pass rows, next card. Then a small confetti of 26 ink-coloured discs from the stage centre (created and removed by the effect; `aria-hidden`).
4. **CSS-only micro-interactions** (no JS): button press `scale(.97)`, focus offset shadow, tick draw, stepper ping on the active dot, error shake, spinner. All already in the CSS.
If `gsap` fails to import or `prefersReduced()` is true, skip the effects entirely; the UI is already in its final state.

---

## 11. Accessibility checklist (must pass)

- One `h1` per page (band title / Success title); step titles `h2`; step change moves focus to the `h2` and updates a polite live region.
- Every input has a visible `<label htmlFor>`; hints and errors linked via `aria-describedby`; invalid fields `aria-invalid`; error text `role="alert"`.
- Year group: `role="radiogroup"` with an accessible name; each radio is a real input.
- Decorative SVGs/discs `aria-hidden="true"`; icons that are the only content of a button have an `aria-label`.
- Colour contrast: body text ink on paper/white ≫ 4.5:1; error text `#B8135A` on white ≈ 6.4:1; `--ink-soft` (#4B4979) on paper ≈ 7:1. Do not use `--pink` or `--sun` as text colour on light backgrounds.
- Keyboard: tab order follows visual order; sticky buttons reachable; custom checkbox and radio show a 3px ink focus ring.
- `prefers-reduced-motion`: no transforms/animations beyond instant state changes.
- Touch: inputs 56px tall, buttons ≥ 46px, spacing ≥ 8px between tap targets.
- Works at 320–430 px width with no horizontal scroll (`documentElement.scrollWidth <= innerWidth`).

---

## 12. Order of work and commits

| # | Commit | Contents | Done when |
|---|---|---|---|
| 1 | `chore: fonts + deps + config tones + sprite` | Phase 0 | build passes, no visual change |
| 2 | `feat: riso.css scoped theme` | Phase 1 | `.riso` demo page renders tokens; legacy pages unchanged |
| 3 | `feat: DomainBand, Stepper, Field, InfoBox, Banner, HelpFooter, StickyActions` | Phase 2 | Home/Edit pages visually unchanged; Register shell shows band + stepper |
| 4 | `feat: Step1 + Step2 restyle` | 8.1–8.3 | steps 1–2 work end to end |
| 5 | `feat: PhotoStep restyle` | 8.3b | all four modes work; crop output unchanged |
| 6 | `feat: Step4 + draft banner` | 8.4–8.5 | full registration saves a row |
| 7 | `feat: Success` | Section 9 | success page renders from router state and from `sessionStorage` |
| 8 | `feat: motion` | Section 10 | optional; app fully works with it disabled |

Rollback: each commit is independently revertible because the theme is scoped. If something goes wrong, remove the `riso` class from the page shell to get the old look back instantly.

---

## 13. Verification (do all of it; paste results in the PR)

**Static:** `tsc --noEmit`, lint, production build, no new console warnings.

**Manual script (mobile viewport 390×844 and 360×740, then a desktop window):**
1. `/register/technical`: band shows "Technical" in the sun tone, stepper at step 1, banners absent.
2. Type a wrong name → red field, "not found" panel with 3 numbered checks and WhatsApp button; type a name already registered → amber panel; with registration closed → closed banner + panel; unplug network → network error note.
3. Valid name (capitals/spaces differ) → green tick, "Found you", Continue → step 2 (focus on heading, stepper step 1 shows the check).
4. Step 2: submit empty → every field shows its message (exact strings from the zod schema), the first invalid field is focused and visible above the sticky bar; fix them one by one; typo `anam@gmial.com` shows the suggestion, **Fix it** works; paste into confirm email is blocked; alt phone equal to phone is rejected.
5. Step 3: take photo / choose from gallery; HEIC file; >15 MB file; tiny file; crop drag, zoom slider, rotate, reset; Use this photo; ready previews show the cropped image in the avatar and the ID card; Retake; Choose another; Adjust crop; Continue.
6. Step 4: all values correct; each **Edit** button jumps to the right step and back; submit unticked → error + shake; offline → error; remove photo path → "go back" link works; simulate upload failure (block the storage URL) → retry then message; simulate `submit_registration` conflict codes → messages from `getError`; double-tap Submit → only one request; honeypot filled → fake success, no request.
7. Success: shows photo, name, domain, roll, IST time; refresh the page → still renders from `sessionStorage`; `/success` opened directly with no state → existing redirect behaviour.
8. Reload mid-wizard → draft restored, banner shown, photo asked again; **Start over** clears everything.
9. Invalid slug `/register/foo` → pick-your-team page; every tile navigates.
10. Keyboard-only run through the whole flow; screen-reader smoke test of step announcements; reduced-motion on; slow 3G; offline banner.
11. Compare screenshots to `register.html` at 390 and 360 px for each state (use the "Preview states" panel to reach them). Differences must be limited to real data.

**Automated (recommended):** a Playwright script that fills the flow with fixture data against a Supabase test project and asserts no horizontal overflow at 360/390 and zero console errors.

---

## 14. Mockup-only things (do NOT port)

- `details#dev` + `.dev*` CSS, the `DO` / `DEV` tables, `view()`, `demoFill()`, `submitDemo()`, `window.__dev`, URL query parameters (`?view=…`, `?d=…`, `?closed`, `?offline`).
- The fake `wait()` delays, the hard-coded names "Anam Patave" / "Mahaveer Gugliya", hard-coded roll `21CO101`, `SAMPLE` portrait, `person()`/`portrait()` generators (export static SVGs once, see 8.3b).
- The CSS-variable crop emulation (`--fx --fy --z --r`, `.crop__img`, pointer handlers, `.pv__img` 125% scale hack).
- The toast and the global link-click interceptor.
- Placeholder links: `https://wa.me/91XXXXXXXXXX`, `mailto:sambhav@example.com`, `https://chat.whatsapp.com/XXXX`. Real values come from `settings` / `config`.
- `<meta name="robots">` and `<title>` of the mockup (the app already has its own).
- The mockup shows both `#wizard` and `#success` in one file; in the app they are separate routes.

---

## 15. Copy changes at a glance (everything else stays word for word)

| Where | Before | After | Why |
|---|---|---|---|
| Step 1 ok panel | "✓ Found you on the X team list!" / "Great — tap Continue to fill in your details." | "Found you on the X team list!" / "Great. Tap Continue to fill in your details." | icon replaces ✓; no em dash |
| Step 1 not-found button | "📱 Report a problem with my name" | "Report a problem with my name" (+ icon) | emoji removed |
| Step 2 alt phone | placeholder "Optional" | "Optional" pill beside the label | clearer |
| Step 2 confirm email hint | "Type it again to be sure." | "Type it again to be sure. Pasting is turned off on purpose." | explains blocked paste |
| Step 3 DO title | "Clear ID photo" | "A clear ID photo" | grammar |
| Step 3 format note | "Accepts JPG, PNG, WebP or iPhone HEIC • Maximum 15 MB • Square 800×800 px ID format" | "JPG, PNG, WebP or iPhone HEIC · up to 15 MB · saved as a square 800×800 ID photo" | shorter |
| Step 3 primary | "Continue to Review" | "Continue" | fits 360 px |
| Step 4 primary | "Submit registration" | "Submit" | fits 360 px |
| Step 4 privacy | "🔒 …" | lock icon + same sentence | emoji removed |
| Step 4 | extra note "Note: Your name will be saved exactly…" | removed (same sentence is in the description) | duplicate |
| Photo draft notice | "Please add your photo again (photos aren't saved in drafts)." | "Please add your photo again. Photos aren't saved in drafts." | no parentheses |

If a product owner objects to any change, restore the old string; it does not affect layout except the two button labels (check 360 px).

---

## 16. Definition of done

- Every state in the mockup is reachable in the real app with real data and looks like the mockup at 390 and 360 px.
- No change to API calls, RPC names, validation rules, error codes, retry timings, storage paths, draft keys, router state shape or honeypot behaviour (diff of `src/lib`, `src/hooks`, `src/contexts` is empty).
- Home, RequestEdit, EditDetails and Admin pages look exactly as before this change.
- `build`, `lint` and the manual script in Section 13 pass; reduced-motion and keyboard runs are clean.
- The PR description lists every deviation from this plan and why.
