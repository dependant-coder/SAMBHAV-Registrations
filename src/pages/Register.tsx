// Register.tsx — 4-step registration wizard per spec §8 & §15
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Stepper } from '../components/Stepper';
import { Field } from '../components/Field';
import { InfoBox } from '../components/InfoBox';
import { GlobalBanners, DraftBanner } from '../components/Banner';
import { HelpFooter } from '../components/HelpFooter';
import { DomainBand } from '../components/DomainBand';
import { StickyActions } from '../components/StickyActions';
import { PhotoStep } from '../components/PhotoStep';
import gsap from 'gsap';
import { prefersReduced } from '../lib/motion';

import { DOMAINS, DOMAIN_MAP, VALID_DOMAIN_SLUGS, YEAR_LABELS, ROLL_EXAMPLE, EMAIL_TYPOS } from '../config';
import { checkName, submitRegistration, uploadPhoto, photoUrl } from '../lib/api';
import { normalizePhone, normalizeRoll } from '../lib/normalize';
import { useApp } from '../contexts/AppContext';
import { useDraft } from '../hooks/useDraft';
import { useOnline } from '../hooks/useOnline';
import { getError } from '../lib/errors';

const YEAR_TITLE: Record<number, string> = {
  1: 'First Year',
  2: 'Second Year',
  3: 'Third Year',
  4: 'Final Year',
};

const YEAR_SHORT: Record<number, string> = {
  1: 'FE',
  2: 'SE',
  3: 'TE',
  4: 'BE',
};

// ── Step 1 — Name verification ───────────────────────────────────────────────
type NameCheckStatus = 'idle' | 'checking' | 'ok' | 'not_found' | 'already_registered' | 'closed' | 'error';

interface Step1Props {
  domainSlug: string;
  domainName: string;
  savedName: string;
  onVerified: (name: string) => void;
  helpWhatsappUrl?: string | null;
}

function Step1({ domainSlug, domainName, savedName, onVerified, helpWhatsappUrl }: Step1Props) {
  const [name, setName] = useState(savedName);
  const [status, setStatus] = useState<NameCheckStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setStatus('error');
      setErrorMsg('Please enter your full name (at least 2 characters).');
      inputRef.current?.focus();
      return;
    }
    setStatus('checking');
    setErrorMsg('');
    try {
      const result = await checkName(domainSlug, trimmed);
      setStatus(result);
    } catch (err) {
      console.error('[Step1] checkName error:', err);
      setStatus('error');
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('Failed to fetch') || raw.includes('fetch') || raw.includes('NetworkError')) {
        setErrorMsg("Couldn't reach the server. Check your connection and try again.");
      } else {
        setErrorMsg(raw || "Couldn't reach the server. Check your connection and try again.");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleContinue();
  };

  const whatsappMsg = encodeURIComponent(
    `Hi, I'm trying to register for Sambhav 4.0 in the ${domainName} domain, but my name "${name.trim()}" isn't being accepted.`
  );
  const whatsappHref = helpWhatsappUrl
    ? `${helpWhatsappUrl}?text=${whatsappMsg}`
    : `https://wa.me/?text=${whatsappMsg}`;

  return (
    <section className="step" id="s1" aria-labelledby="s1-h">
      <p className="eyebrow">Step 1 of 4</p>
      <h2 className="h2" id="s1-h" tabIndex={-1}>
        Verify your name
      </h2>
      <p className="desc">
        Type your full name exactly as it appears on the <b>{domainName}</b> team list. Capital letters don’t matter.
      </p>

      <InfoBox variant="info">
        <strong>One word names are fine.</strong> Type whatever name was used when you were selected.
      </InfoBox>

      <Field
        label="Full name"
        required
        hint="As written on the team list. Capital letters don’t matter. Minimum 2 characters."
        valid={status === 'ok'}
        error={status === 'error' ? errorMsg : undefined}
        invalid={status === 'not_found'}
      >
        {({ id, ...aria }) => (
          <input
            ref={inputRef}
            id={id}
            type="text"
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setStatus('idle');
            }}
            onKeyDown={handleKeyDown}
            maxLength={80}
            minLength={2}
            autoComplete="name"
            spellCheck={false}
            placeholder="e.g. Ram Patil"
            {...aria}
          />
        )}
      </Field>

      {/* ─── Result panels per spec §8.2 & §15 ─── */}
      {status === 'not_found' && (
        <div className="result result--bad" role="alert">
          <h3>We couldn’t find that name in the {domainName} team list.</h3>
          <p>Check these, then try again:</p>
          <ol className="checks">
            <li>
              <b>Spelling and spaces.</b> Type your name exactly as in the team list. Capital letters don’t matter.
            </li>
            <li>
              <b>Full name.</b> No nicknames, no initials, no changed word order.
            </li>
            <li>
              <b>Right domain.</b> You’re registering for <b>{domainName}</b>. If you were selected for another domain,{' '}
              <Link to="/">go back and choose it</Link>.
            </li>
          </ol>
          <p style={{ marginTop: '10px' }}>Still stuck? Your name may be spelled differently on the list.</p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ink btn--sm"
          >
            <svg className="ic" aria-hidden="true"><use href="#i-wa" /></svg>
            Report a problem with my name
          </a>
        </div>
      )}

      {status === 'already_registered' && (
        <div className="result result--warn" role="alert">
          <h3>This name is already registered for {domainName}.</h3>
          <p>If that was you, you’re all set and there’s nothing more to do.</p>
          <p>
            If you didn’t register, or something is wrong, tell us:{' '}
            <Link to="/request-edit">Request an edit</Link>
            {' or '}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              Contact the core team
            </a>.
          </p>
        </div>
      )}

      {status === 'closed' && (
        <div className="result result--closed" role="alert">
          <h3>Registration is closed.</h3>
          <p>
            If you were selected but haven’t registered, please contact the core team:{' '}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </p>
        </div>
      )}

      {status === 'ok' && (
        <div className="result result--ok is-new" role="status">
          <span className="bigcheck" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div>
            <h3>Found you on the {domainName} team list!</h3>
            <p>Great. Tap Continue to fill in your details.</p>
          </div>
        </div>
      )}

      <StickyActions>
        <Link to="/" className="btn btn--ghost" aria-label="Back to home">
          <svg className="ic" aria-hidden="true"><use href="#i-arrow-l" /></svg>
          Back
        </Link>
        {status === 'ok' ? (
          <button
            type="button"
            className="btn btn--ink btn--main"
            onClick={() => onVerified(name.trim())}
          >
            Continue
            <svg className="ic" aria-hidden="true"><use href="#i-arrow-r" /></svg>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--ink btn--main"
            onClick={handleContinue}
            disabled={status === 'checking'}
          >
            {status === 'checking' ? (
              <>
                <span className="spin" aria-hidden="true" />
                Checking…
              </>
            ) : (
              <>
                Continue
                <svg className="ic" aria-hidden="true"><use href="#i-arrow-r" /></svg>
              </>
            )}
          </button>
        )}
      </StickyActions>
    </section>
  );
}

// ── Step 2 Schema ────────────────────────────────────────────────────────────
function buildStep2Schema(rollRegex: string) {
  return z.object({
    roll_number: z
      .string()
      .min(4, 'Roll number is too short')
      .max(20, 'Roll number is too long')
      .refine(v => new RegExp(rollRegex).test(normalizeRoll(v)), {
        message: `That roll number doesn’t look right. Use the exact number on your college ID, e.g. ${ROLL_EXAMPLE}.`,
      }),
    year: z.preprocess(
      v => (v === '' || v === undefined || v === null ? undefined : Number(v)),
      z
        .number({ invalid_type_error: 'Please choose your year' })
        .int()
        .min(1, 'Please choose a valid year')
        .max(4, 'Please choose a valid year')
    ),
    branch: z.string().min(1, 'Please choose your branch'),
    phone: z.string().refine(v => {
      const n = normalizePhone(v);
      return n !== null && /^[6-9][0-9]{9}$/.test(n);
    }, { message: 'Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.' }),
    alt_phone: z.string().optional().refine(v => {
      if (!v || v.trim() === '') return true;
      const n = normalizePhone(v);
      return n !== null && /^[6-9][0-9]{9}$/.test(n);
    }, { message: 'The alternate number must be a 10-digit mobile number, or leave it empty.' }),
    email: z
      .string()
      .email('Please enter a valid email address.')
      .max(254)
      .toLowerCase(),
    email_confirm: z.string().email('Please enter a valid email address.'),
  }).refine(
    d => {
      if (!d.alt_phone || d.alt_phone.trim() === '') return true;
      return normalizePhone(d.alt_phone) !== normalizePhone(d.phone);
    },
    { message: 'The alternate number must be different from your main number, or leave it empty.', path: ['alt_phone'] }
  ).refine(
    d => d.email.toLowerCase() === d.email_confirm.toLowerCase(),
    { message: "Email addresses don’t match. Please retype the second one.", path: ['email_confirm'] }
  );
}

type Step2Data = {
  roll_number: string;
  year: number;
  branch: string;
  phone: string;
  alt_phone?: string;
  email: string;
  email_confirm: string;
};

interface Step2Props {
  verifiedName: string;
  branches: string[];
  rollRegex: string;
  savedData: Partial<Step2Data>;
  onNext: (data: Step2Data) => void;
  onBack: () => void;
}

function Step2({ verifiedName, branches, rollRegex, savedData, onNext, onBack }: Step2Props) {
  const schema = buildStep2Schema(rollRegex);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step2Data>({
    resolver: zodResolver(schema) as unknown as Resolver<Step2Data>,
    defaultValues: {
      roll_number: savedData.roll_number ?? '',
      year: savedData.year ? (String(savedData.year) as unknown as number) : undefined,
      branch: savedData.branch ?? '',
      phone: savedData.phone ?? '',
      alt_phone: savedData.alt_phone ?? '',
      email: savedData.email ?? '',
      email_confirm: savedData.email_confirm ?? '',
    },
  });

  const emailValue = watch('email');
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const domain = emailValue?.split('@')[1]?.toLowerCase();
    if (domain && EMAIL_TYPOS[domain]) {
      setEmailSuggestion(EMAIL_TYPOS[domain]);
    } else {
      setEmailSuggestion(null);
    }
  }, [emailValue]);

  const applyEmailSuggestion = () => {
    const [local] = emailValue.split('@');
    setValue('email', `${local}@${emailSuggestion}`, { shouldValidate: true });
    setEmailSuggestion(null);
  };

  const onSubmit = (data: Step2Data) => {
    onNext(data);
  };

  const handleInvalid = () => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      document.getElementById(`field-${firstError}`)?.focus();
    }
  };

  return (
    <section className="step" id="s2" aria-labelledby="s2-h">
      <p className="eyebrow">Step 2 of 4</p>
      <h2 className="h2" id="s2-h" tabIndex={-1}>
        Your details
      </h2>
      <p className="desc">These go on your ID card and team lists. Please double-check them.</p>

      {verifiedName && (
        <p className="vchip">
          <i>
            <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>
          </i>
          <span>{verifiedName}</span>
        </p>
      )}

      <form
        id="f2"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Personal details form"
      >
        {/* Roll number */}
        <Field
          label="Roll number"
          hint={`As printed on your college ID. Example: ${ROLL_EXAMPLE}`}
          error={errors.roll_number?.message}
          required
        >
          {({ id, ...aria }) => (
            <input
              {...register('roll_number')}
              id={id}
              type="text"
              className="input input--roll"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              {...aria}
            />
          )}
        </Field>

        {/* Year */}
        <Field
          label="Year of study"
          hint="Your current year of study this academic year"
          error={errors.year?.message}
          required
          bare
        >
          {({ id, ...aria }) => (
            <div className="yrs" role="radiogroup" aria-label="Year of study" id={id}>
              {([1, 2, 3, 4] as const).map((yr) => (
                <label key={yr} className="yr">
                  <input
                    type="radio"
                    value={yr}
                    {...register('year')}
                    {...(yr === 1 ? { 'aria-describedby': aria['aria-describedby'] } : {})}
                  />
                  <span className="yr__box">
                    <span className="yr__n" aria-hidden="true">{yr}</span>
                    <span>
                      <span className="yr__t">{YEAR_TITLE[yr]}</span>
                      <span className="yr__s">{YEAR_SHORT[yr]}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>

        {/* Branch */}
        <Field
          label="Branch"
          hint="Pick the closest match. Choose Other if yours isn’t listed."
          error={errors.branch?.message}
          required
        >
          {({ id, ...aria }) => (
            <div className="select-wrap">
              <select
                {...register('branch')}
                id={id}
                className="select"
                required
                {...aria}
              >
                <option value="" disabled>Select your branch…</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
        </Field>

        {/* Mobile */}
        <Field
          label="Mobile number"
          hint="10-digit Indian mobile number. You can type +91 or not."
          prefix="+91"
          error={errors.phone?.message}
          required
        >
          {({ id, ...aria }) => (
            <input
              {...register('phone')}
              id={id}
              type="tel"
              inputMode="numeric"
              className="input input--pre"
              maxLength={15}
              autoComplete="tel"
              {...aria}
            />
          )}
        </Field>

        {/* Alt mobile */}
        <Field
          label="Alternate mobile number"
          hint="A backup number (parent, friend or second SIM). Leave empty if you don’t have one."
          prefix="+91"
          optional
          error={errors.alt_phone?.message}
        >
          {({ id, ...aria }) => (
            <input
              {...register('alt_phone')}
              id={id}
              type="tel"
              inputMode="numeric"
              className="input input--pre"
              maxLength={15}
              {...aria}
            />
          )}
        </Field>

        {/* Email */}
        <Field
          label="Email address"
          hint="We’ll use this for important updates. Use one you check often."
          error={errors.email?.message}
          required
        >
          {({ id, ...aria }) => (
            <>
              <input
                {...register('email')}
                id={id}
                type="email"
                autoComplete="email"
                className="input"
                maxLength={254}
                {...aria}
              />
              {emailSuggestion && (
                <div className="sugg">
                  <span>Did you mean <b>{emailValue.split('@')[0]}@{emailSuggestion}</b>?</span>
                  <button type="button" onClick={applyEmailSuggestion}>Fix it</button>
                </div>
              )}
            </>
          )}
        </Field>

        {/* Confirm email */}
        <Field
          label="Confirm email address"
          hint="Type it again to be sure. Pasting is turned off on purpose."
          error={errors.email_confirm?.message}
          required
        >
          {({ id, ...aria }) => (
            <input
              {...register('email_confirm')}
              id={id}
              type="email"
              autoComplete="off"
              className="input"
              maxLength={254}
              onPaste={(e) => e.preventDefault()}
              {...aria}
            />
          )}
        </Field>

        <StickyActions>
          <button type="button" onClick={onBack} className="btn btn--ghost">
            <svg className="ic" aria-hidden="true"><use href="#i-arrow-l" /></svg>
            Back
          </button>
          <button type="submit" className="btn btn--ink btn--main" onClick={handleInvalid}>
            Continue
            <svg className="ic" aria-hidden="true"><use href="#i-arrow-r" /></svg>
          </button>
        </StickyActions>
      </form>
    </section>
  );
}

// ── Step 4 — Review & Submit ─────────────────────────────────────────────────
interface ReviewData {
  name: string;
  domainSlug: string;
  domainName: string;
  roll_number: string;
  year: number;
  branch: string;
  phone: string;
  alt_phone?: string;
  email: string;
  photoBlob: Blob | null;
  photoPreviewUrl?: string | null;
  photoPath: string | null;
}

interface Step4Props {
  data: ReviewData;
  onBack: () => void;
  onGoToStep: (step: 1 | 2 | 3) => void;
  onPhotoUploaded: (path: string | null) => void;
  onSuccess: (fullName: string, domain: string, registeredAt: Date, photoPath: string) => void;
}

type SubmitState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';

function Step4({ data, onBack, onGoToStep, onPhotoUploaded, onSuccess }: Step4Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmShaking, setConfirmShaking] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [submitErrorStep, setSubmitErrorStep] = useState<number | undefined>();
  const online = useOnline();
  const submitLock = useRef(false);

  const phoneDisplay = normalizePhone(data.phone) ?? data.phone;
  const altPhoneDisplay = data.alt_phone ? (normalizePhone(data.alt_phone) ?? data.alt_phone) : null;
  const rollDisplay = normalizeRoll(data.roll_number);

  const handleSubmit = async () => {
    if (submitLock.current || submitState === 'uploading' || submitState === 'saving') return;

    // Check honeypot (spec §12)
    const websiteInput = document.querySelector<HTMLInputElement>('input[name="website"]');
    if (websiteInput && websiteInput.value.trim() !== '') {
      setSubmitState('saving');
      setTimeout(() => {
        onSuccess(data.name, data.domainSlug, new Date(), 'uploads/dummy-bot.jpg');
      }, 600);
      return;
    }

    if (!confirmed) {
      setSubmitError('Please confirm your details by ticking the checkbox.');
      setConfirmShaking(true);
      return;
    }
    if (!online) {
      setSubmitError("You’re offline. Reconnect to submit.");
      return;
    }
    if (!data.photoBlob && !data.photoPath) {
      setSubmitError('Please add and crop your photo before submitting.');
      setSubmitErrorStep(3);
      return;
    }

    submitLock.current = true;
    setSubmitError('');

    try {
      let photoPath = data.photoPath;

      // Upload photo if not yet uploaded (spec §9.2 Step 4)
      if (data.photoBlob && !photoPath) {
        setSubmitState('uploading');
        let uploadError: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            photoPath = await uploadPhoto(data.photoBlob);
            uploadError = null;
            break;
          } catch (e) {
            uploadError = e instanceof Error ? e : new Error(String(e));
            if (attempt < 2) await new Promise((r) => setTimeout(r, attempt === 0 ? 1000 : 3000));
          }
        }
        if (uploadError || !photoPath) {
          setSubmitState('error');
          setSubmitError("Couldn’t upload your photo. Check your connection and try again.");
          submitLock.current = false;
          return;
        }
        onPhotoUploaded(photoPath);
      }

      setSubmitState('saving');
      const result = await submitRegistration({
        p_domain: data.domainSlug,
        p_name: data.name,
        p_roll: rollDisplay,
        p_email: data.email.toLowerCase(),
        p_phone: phoneDisplay ?? '',
        p_alt_phone: altPhoneDisplay,
        p_year: data.year,
        p_branch: data.branch,
        p_photo_path: photoPath ?? '',
      });

      if (result.ok) {
        setSubmitState('done');
        onSuccess(result.full_name ?? data.name, result.domain ?? data.domainSlug, new Date(), photoPath ?? '');
      } else {
        const errInfo = getError(result.code ?? 'conflict');
        setSubmitState('error');
        setSubmitError(errInfo.message);
        if (errInfo.step) setSubmitErrorStep(errInfo.step);
        if (result.code === 'photo_missing') {
          onPhotoUploaded(null);
        }
      }
    } catch {
      setSubmitState('error');
      setSubmitError("We couldn’t confirm that your details were saved. Tap Submit again. It’s safe, you won’t be registered twice.");
    } finally {
      submitLock.current = false;
    }
  };

  const reviewRows: { label: string; value: string; step: 1 | 2 | 3 }[] = [
    { label: 'Domain', value: data.domainName, step: 1 },
    { label: 'Name', value: data.name, step: 1 },
    { label: 'Roll number', value: rollDisplay, step: 2 },
    { label: 'Year', value: YEAR_LABELS[data.year], step: 2 },
    { label: 'Branch', value: data.branch, step: 2 },
    { label: 'Mobile', value: phoneDisplay ?? data.phone, step: 2 },
    ...(altPhoneDisplay ? [{ label: 'Alternate mobile', value: altPhoneDisplay, step: 2 as const }] : []),
    { label: 'Email', value: data.email, step: 2 },
  ];

  return (
    <section className="step" id="s4" aria-labelledby="s4-h">
      <p className="eyebrow">Step 4 of 4</p>
      <h2 className="h2" id="s4-h" tabIndex={-1}>
        Review your details
      </h2>
      <p className="desc">
        Check everything carefully before submitting. Your name will be saved exactly as it appears
        on the team list.
      </p>

      {/* Review card */}
      <div className="rev" id="rev">
        <div className="rev__head">
          <div className="pv">
            {data.photoPreviewUrl ? (
              <img src={data.photoPreviewUrl} alt="Your photo" />
            ) : (
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: '100%',
                  height: '100%',
                  fontWeight: 800,
                  fontSize: '24px',
                  background: 'var(--paper-deep)',
                }}
              >
                {data.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="rev__who">
            <p className="rev__name">{data.name}</p>
            <p className="rev__dom">{data.domainName}</p>
          </div>
          <button
            type="button"
            className="rev__edit rev__edit--head"
            onClick={() => onGoToStep(3)}
            aria-label="Edit photo"
          >
            Edit photo
          </button>
        </div>

        {reviewRows.map((row) => (
          <div key={row.label} className="rev__row">
            <span className="rev__k">{row.label}</span>
            <span className="rev__v">{row.value}</span>
            <button
              type="button"
              className="rev__edit"
              onClick={() => onGoToStep(row.step)}
              aria-label={`Edit ${row.label}`}
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {!data.photoBlob && !data.photoPath && (
        <InfoBox variant="warning" className="revnote">
          No photo uploaded
        </InfoBox>
      )}

      {/* Confirmation checkbox */}
      <label
        className={`confirm ${confirmShaking ? 'shake' : ''}`}
        onAnimationEnd={() => setConfirmShaking(false)}
      >
        <input
          type="checkbox"
          id="review-confirm"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="tick" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <span>
          I confirm these details are correct. I understand that changing them later needs
          approval from the core team.
        </span>
      </label>

      {/* Honeypot (bot trap — visually hidden, spec §12) */}
      <input
        type="text"
        name="website"
        className="honeypot sr-only"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
      />

      {/* Privacy note */}
      <p className="privacy">
        <svg className="ic" aria-hidden="true">
          <use href="#i-lock" />
        </svg>
        Your details are visible only to the Sambhav core team.
      </p>

      {/* Errors */}
      {submitError && (
        <InfoBox variant="error" id="submit-error">
          {submitError}
          {submitErrorStep && (
            <>
              {' '}
              <button
                type="button"
                className="linkbtn"
                onClick={() => onGoToStep(submitErrorStep as 1 | 2 | 3)}
              >
                Go back and fix it
              </button>
            </>
          )}
        </InfoBox>
      )}

      {/* Progress states */}
      {(submitState === 'uploading' || submitState === 'saving') && (
        <div className="prog" role="status">
          <p className="prog__t">
            <span className="spin" aria-hidden="true" />
            <span>{submitState === 'uploading' ? 'Uploading your photo…' : 'Saving your details…'}</span>
          </p>
          <div className="prog__bar">
            <i style={{ width: submitState === 'uploading' ? '55%' : '90%' }} />
          </div>
        </div>
      )}

      <StickyActions>
        <button
          type="button"
          onClick={onBack}
          className="btn btn--ghost"
          disabled={submitState === 'uploading' || submitState === 'saving'}
        >
          <svg className="ic" aria-hidden="true"><use href="#i-arrow-l" /></svg>
          Back
        </button>
        <button
          type="button"
          id="submit-btn"
          className="btn btn--blue btn--main"
          onClick={handleSubmit}
          disabled={submitState === 'uploading' || submitState === 'saving' || submitState === 'done'}
          aria-describedby={submitError ? 'submit-error' : undefined}
        >
          {submitState === 'uploading'
            ? 'Uploading…'
            : submitState === 'saving'
            ? 'Saving…'
            : 'Submit'}
        </button>
      </StickyActions>
    </section>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────

interface WizardDraft {
  name?: string;
  step2?: Partial<Step2Data>;
}

const WIZARD_STEPS = ['Verify name', 'Details', 'Photo', 'Review'];

export default function Register() {
  const { domainSlug } = useParams<{ domainSlug: string }>();
  const navigate = useNavigate();
  const { branches, settings } = useApp();

  // Draft persistence
  const { load: loadDraft, save: saveDraft, clear: clearDraft } = useDraft<WizardDraft>(
    `register_${domainSlug}`
  );

  const [initialDraft] = useState(() => loadDraft());
  const [step, setStep] = useState(1);
  const [verifiedName, setVerifiedName] = useState(() => initialDraft?.name ?? '');
  const [step2Data, setStep2Data] = useState<Partial<Step2Data>>(() => initialDraft?.step2 ?? {});
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [hadDraftRestored] = useState(() => Boolean(initialDraft?.name || initialDraft?.step2));
  const [showDraftBanner, setShowDraftBanner] = useState(true);

  const prevStepRef = useRef(step);
  const liveRegionRef = useRef<HTMLParagraphElement>(null);

  // Draft cleanup handler
  const handleStartOver = () => {
    clearDraft();
    setStep(1);
    setVerifiedName('');
    setStep2Data({});
    setPhotoBlob(null);
    setPhotoPreviewUrl(null);
    setPhotoPath(null);
    setShowDraftBanner(false);
  };

  // Scroll and focus on step change
  useEffect(() => {
    if (prevStepRef.current !== step) {
      const reduced = prefersReduced();
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });

      // Move focus to current step h2
      setTimeout(() => {
        const h2 = document.getElementById(`s${step}-h`);
        h2?.focus();
      }, 50);

      // Announce live region
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = `Step ${step} of 4: ${WIZARD_STEPS[step - 1]}`;
      }

      if (!reduced) {
        const el = document.querySelector<HTMLElement>('section.step');
        if (el) {
          const dir = step >= prevStepRef.current ? 1 : -1;
          gsap.fromTo(
            el,
            { x: dir * 26, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' }
          );
        }
      }
      prevStepRef.current = step;
    }
  }, [step]);

  // Save draft whenever step2 data changes
  const handleStep2Save = useCallback(
    (data: Step2Data) => {
      setStep2Data(data);
      saveDraft({ name: verifiedName, step2: data });
      setStep(3);
    },
    [verifiedName, saveDraft]
  );

  // Validate domain slug
  if (!domainSlug || !VALID_DOMAIN_SLUGS.has(domainSlug)) {
    return (
      <div className="riso-shell">
        <div className="riso app" data-tone="blue">
          <DomainBand
            title="Pick your team"
            eyebrow="Hmm, that link"
            showChange={false}
          />
          <main id="main">
            <section className="step">
              <h2 className="h2" tabIndex={-1}>
                That team link isn’t right
              </h2>
              <p className="desc">
                The domain in this link doesn’t match any team. Choose your domain from the list below.
              </p>
              <div className="minis">
                {DOMAINS.map((d) => (
                  <a
                    key={d.slug}
                    href={`/register/${d.slug}`}
                    className="mini"
                    data-tone={d.tone}
                  >
                    <svg aria-hidden="true" viewBox="0 0 64 64">
                      <use href={`#g-${d.glyph}`} />
                    </svg>
                    <span>{d.name}</span>
                  </a>
                ))}
              </div>
            </section>
          </main>
          <HelpFooter />
        </div>
      </div>
    );
  }

  const domainConfig = DOMAIN_MAP[domainSlug];
  const branchNames = branches.map((b) => b.name);
  const rollRegex = settings?.roll_regex ?? '^[A-Z0-9/-]{4,20}$';

  const handleNameVerified = (name: string) => {
    setVerifiedName(name);
    saveDraft({ name, step2: step2Data });
    setStep(2);
  };

  const handleSuccess = (
    fullName: string,
    domain: string,
    registeredAt: Date,
    uploadedPhotoPath: string
  ) => {
    clearDraft();
    const finalPhotoUrl = uploadedPhotoPath ? photoUrl(uploadedPhotoPath) : photoPreviewUrl ?? '';
    const successPayload = {
      fullName,
      domainSlug: domain,
      domainName: DOMAIN_MAP[domain]?.name ?? domain,
      registeredAt: registeredAt.toISOString(),
      roll: normalizeRoll(step2Data.roll_number ?? ''),
      photoUrl: finalPhotoUrl,
    };

    navigate('/success', {
      replace: true,
      state: successPayload,
    });
    sessionStorage.setItem(`sambhav_success_${domain}`, JSON.stringify(successPayload));
  };

  return (
    <div className="riso-shell">
      <div className="riso app" data-tone={domainConfig.tone}>
        <p className="sr" ref={liveRegionRef} aria-live="polite" />
        <DomainBand slug={domainSlug} name={domainConfig.name} />

        <GlobalBanners />

        {hadDraftRestored && showDraftBanner && step < 3 && (
          <div className="banners">
            <DraftBanner onStartOver={handleStartOver} />
          </div>
        )}

        <Stepper steps={WIZARD_STEPS} currentStep={step} />

        <main id="main">
          {step === 1 && (
            <Step1
              domainSlug={domainSlug}
              domainName={domainConfig.name}
              savedName={verifiedName}
              onVerified={handleNameVerified}
              helpWhatsappUrl={settings?.help_whatsapp_url || (settings?.help_phone ? `https://wa.me/${settings.help_phone.replace(/[^0-9]/g, '')}` : null)}
            />
          )}
          {step === 2 && (
            <Step2
              verifiedName={verifiedName}
              branches={branchNames}
              rollRegex={rollRegex}
              savedData={step2Data}
              onNext={handleStep2Save}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <PhotoStep
              existingBlob={photoBlob}
              existingPreviewUrl={photoPreviewUrl}
              hadDraftRestored={hadDraftRestored}
              fullName={verifiedName}
              domainName={domainConfig.name}
              onNext={(blob, preview) => {
                setPhotoBlob(blob);
                setPhotoPreviewUrl(preview);
                setPhotoPath(null);
                setStep(4);
              }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && step2Data.email && (
            <Step4
              data={{
                name: verifiedName,
                domainSlug,
                domainName: domainConfig.name,
                roll_number: step2Data.roll_number ?? '',
                year: step2Data.year ?? 1,
                branch: step2Data.branch ?? '',
                phone: step2Data.phone ?? '',
                alt_phone: step2Data.alt_phone,
                email: step2Data.email,
                photoBlob,
                photoPreviewUrl,
                photoPath,
              }}
              onBack={() => setStep(3)}
              onGoToStep={(s) => setStep(s)}
              onPhotoUploaded={(p) => setPhotoPath(p)}
              onSuccess={handleSuccess}
            />
          )}

          <p className="startover">
            <button type="button" className="linkbtn" onClick={handleStartOver}>
              Start over
            </button>
          </p>
        </main>

        <HelpFooter />
      </div>
    </div>
  );
}
