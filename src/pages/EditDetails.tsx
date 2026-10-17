// EditDetails.tsx — spec §9.5 — Edit details page
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { GlobalBanners } from '../components/Banner';
import { HelpFooter } from '../components/HelpFooter';
import { InfoBox } from '../components/InfoBox';
import { PhotoStep } from '../components/PhotoStep';
import { getMemberForEdit, applyMemberEdit, uploadPhoto, photoUrl } from '../lib/api';
import type { MemberData } from '../lib/api';
import { normalizePhone, normalizeRoll, isValidPhone, isValidEmail } from '../lib/normalize';
import { formatCountdown, hoursMinutesUntil } from '../lib/dates';
import { YEAR_LABELS, DOMAIN_MAP } from '../config';
import { useApp } from '../contexts/AppContext';
import { getError } from '../lib/errors';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'verify' | 'loading' | 'edit' | 'success';

interface FieldErrors {
  year?: string;
  branch?: string;
  phone?: string;
  alt_phone?: string;
  email?: string;
  photo?: string;
}

// ── Locked field display ─────────────────────────────────────────────────────

function LockedField({ label, value }: { label: string; value: string }) {
  const LOCK_TITLE = 'Only an admin can change this. Use Request an edit and explain.';
  return (
    <div className="field">
      <span className="field__label">
        {label}{' '}
        <span
          aria-label={LOCK_TITLE}
          title={LOCK_TITLE}
          style={{ cursor: 'help', fontSize: '0.9em' }}
        >
          🔒
        </span>
      </span>
      <div
        style={{
          padding: '0.55rem 0.75rem',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.375rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.95rem',
        }}
        aria-label={`${label}: ${value} (locked)`}
      >
        {value}
      </div>
    </div>
  );
}

// ── Countdown banner ─────────────────────────────────────────────────────────

function CountdownBanner({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState(() => formatCountdown(expiresAt));
  const [expired, setExpired] = useState(() => hoursMinutesUntil(expiresAt).expired);

  useEffect(() => {
    const tick = () => {
      const result = hoursMinutesUntil(expiresAt);
      setExpired(result.expired);
      setLabel(formatCountdown(expiresAt));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (expired) {
    return (
      <InfoBox variant="error">
        Your editing window ended.{' '}
        <Link to="/request-edit" className="link">
          Send a new request.
        </Link>
      </InfoBox>
    );
  }

  return (
    <InfoBox variant="warning">
      Edit window closes in <strong>{label}</strong>. Save before it expires.
    </InfoBox>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EditDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { branches } = useApp();

  // ── Phase state ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('verify');

  // ── Verification form state ────────────────────────────────────────────────
  const [verifyRoll, setVerifyRoll] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // ── Member + session data ──────────────────────────────────────────────────
  const [member, setMember] = useState<MemberData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Keep original identity in a ref — never use editable email for API identity
  const identityRef = useRef<{ roll: string; email: string } | null>(null);

  // ── Edit form state ────────────────────────────────────────────────────────
  const [year, setYear] = useState<number>(1);
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');

  // Photo state
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPhotoStep, setShowPhotoStep] = useState(false);

  // Form errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Unsaved changes guard
  const hasChangesRef = useRef(false);

  // ── Countdown expiry (derived from expiresAt, refreshed by CountdownBanner) ─
  const isExpired = expiresAt ? hoursMinutesUntil(expiresAt).expired : false;

  // ── Prefill edit form from member data ────────────────────────────────────
  const prefillForm = useCallback((m: MemberData) => {
    setYear(m.year);
    setBranch(m.branch);
    setPhone(m.phone);
    setAltPhone(m.alt_phone ?? '');
    setEmail(m.email);
    setPhotoBlob(null);
    setPhotoPreview(null);
    hasChangesRef.current = false;
  }, []);

  // ── Transition to edit phase ───────────────────────────────────────────────
  const enterEditPhase = useCallback(
    (m: MemberData, exp: string, roll: string, emailId: string) => {
      identityRef.current = { roll, email: emailId };
      setMember(m);
      setExpiresAt(exp);
      prefillForm(m);
      setPhase('edit');
    },
    [prefillForm]
  );

  // ── Auto-verify from router state ─────────────────────────────────────────
  useEffect(() => {
    const state = location.state as { roll?: string; email?: string } | null;
    if (state?.roll && state?.email) {
      const roll = normalizeRoll(state.roll);
      const emailVal = state.email.trim().toLowerCase();
      setPhase('loading');
      getMemberForEdit(roll, emailVal)
        .then((result) => {
          if (result.ok && result.member && result.expires_at) {
            enterEditPhase(result.member, result.expires_at, roll, emailVal);
          } else {
            const code = result.code ?? 'unknown';
            if (code === 'not_unlocked') {
              setVerifyError(
                "Editing isn't open for you right now."
              );
            } else if (code === 'no_match') {
              setVerifyError(
                "We couldn't find a registration with that roll number and email. Check both and try again."
              );
            } else {
              setVerifyError(getError(code).message);
            }
            setPhase('verify');
          }
        })
        .catch(() => {
          setVerifyError('Something went wrong. Please try again.');
          setPhase('verify');
        });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Unsaved changes guard ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Track changes ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!member) return;
    const changed =
      year !== member.year ||
      branch !== member.branch ||
      phone !== member.phone ||
      altPhone !== (member.alt_phone ?? '') ||
      email !== member.email ||
      photoBlob !== null;
    hasChangesRef.current = changed;
  }, [year, branch, phone, altPhone, email, photoBlob, member]);

  // ── Verification submit ───────────────────────────────────────────────────
  const handleVerify = async () => {
    setVerifyError(null);
    const roll = normalizeRoll(verifyRoll.trim());
    const emailVal = verifyEmail.trim().toLowerCase();
    if (!roll) {
      setVerifyError('Please enter your roll number.');
      return;
    }
    if (!emailVal) {
      setVerifyError('Please enter your email address.');
      return;
    }
    setVerifyLoading(true);
    try {
      const result = await getMemberForEdit(roll, emailVal);
      if (result.ok && result.member && result.expires_at) {
        enterEditPhase(result.member, result.expires_at, roll, emailVal);
      } else {
        const code = result.code ?? 'unknown';
        if (code === 'not_unlocked') {
          setVerifyError('not_unlocked');
        } else if (code === 'no_match') {
          setVerifyError(
            "We couldn't find a registration with that roll number and email. Check both and try again."
          );
        } else {
          setVerifyError(getError(code).message);
        }
      }
    } catch {
      setVerifyError('Something went wrong. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Photo step handlers ───────────────────────────────────────────────────
  const handlePhotoNext = useCallback((blob: Blob, previewUrl: string) => {
    setPhotoBlob(blob);
    setPhotoPreview(previewUrl);
    setShowPhotoStep(false);
    setFieldErrors((prev) => ({ ...prev, photo: undefined }));
  }, []);

  const handlePhotoRevert = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!year || year < 1 || year > 4) {
      errors.year = 'Please choose your year from the list.';
    }
    if (!branch) {
      errors.branch = 'Please choose your branch from the list.';
    }

    const normPhone = normalizePhone(phone);
    if (!isValidPhone(normPhone)) {
      errors.phone = 'Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.';
    }

    if (altPhone.trim()) {
      const normAlt = normalizePhone(altPhone);
      if (!isValidPhone(normAlt)) {
        errors.alt_phone =
          'The alternate number must be a 10-digit mobile number, or leave it empty.';
      } else if (normAlt === normPhone) {
        errors.alt_phone =
          'The alternate number must be different from your main number, or leave it empty.';
      }
    }

    if (!isValidEmail(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    return errors;
  };

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveError(null);
    setFieldErrors({});

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!member || !identityRef.current || !expiresAt) return;

    // Re-check expiry before saving
    if (hoursMinutesUntil(expiresAt).expired) {
      setSaveError(
        "Your editing window ended. Send a new request."
      );
      return;
    }

    setSaving(true);
    try {
      // Upload new photo if changed
      let finalPhotoPath = member.photo_path;
      if (photoBlob) {
        try {
          finalPhotoPath = await uploadPhoto(photoBlob);
        } catch {
          setFieldErrors({ photo: 'Something went wrong with your photo. Please add it again.' });
          setSaving(false);
          return;
        }
      }

      const normPhone = normalizePhone(phone)!;
      const normAlt = altPhone.trim() ? normalizePhone(altPhone) : null;

      const result = await applyMemberEdit({
        p_roll: identityRef.current.roll,
        p_email: identityRef.current.email,
        p_new_email: email.trim().toLowerCase(),
        p_phone: normPhone,
        p_alt_phone: normAlt,
        p_year: year,
        p_branch: branch,
        p_photo_path: finalPhotoPath,
      });

      if (result.ok) {
        hasChangesRef.current = false;
        setPhase('success');
        return;
      }

      const code = result.code ?? 'unknown';
      if (code === 'not_unlocked') {
        setSaveError(
          "Your editing window ended. Send a new request."
        );
      } else if (code === 'invalid_phone') {
        setFieldErrors({ phone: getError(code).message });
      } else if (code === 'invalid_alt_phone') {
        setFieldErrors({ alt_phone: getError(code).message });
      } else if (code === 'alt_same_as_phone') {
        setFieldErrors({ alt_phone: getError(code).message });
      } else if (code === 'invalid_email') {
        setFieldErrors({ email: getError(code).message });
      } else if (code === 'invalid_year') {
        setFieldErrors({ year: getError(code).message });
      } else if (code === 'invalid_branch') {
        setFieldErrors({ branch: getError(code).message });
      } else if (code === 'invalid_photo') {
        setFieldErrors({ photo: getError(code).message });
      } else {
        setSaveError('Something went wrong. Please try again.');
      }
    } catch {
      setSaveError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="page">
        <GlobalBanners />
        <main id="main" className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Verifying your details…</p>
        </main>
      </div>
    );
  }

  // ── Render: success ───────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div className="page">
        <GlobalBanners />
        <main id="main" className="container" style={{ padding: '3rem 1rem' }}>
          <div className="wizard-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <InfoBox variant="success">
              <strong>Saved.</strong> Your editing window is now closed.
            </InfoBox>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button className="btn btn--primary" onClick={() => navigate('/')}>
                Go home
              </button>
            </div>
          </div>
        </main>
        <HelpFooter />
      </div>
    );
  }

  // ── Render: verify ────────────────────────────────────────────────────────
  if (phase === 'verify') {
    return (
      <div className="page">
        <GlobalBanners />
        <main id="main" className="container" style={{ padding: '3rem 1rem' }}>
          <div className="wizard-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <h1 className="wizard-step__title">Verify it's you</h1>
            <p className="wizard-step__desc">
              Enter the roll number and email you registered with to open your edit window.
            </p>

            {verifyError && verifyError === 'not_unlocked' ? (
              <InfoBox variant="error">
                Editing isn't open for you right now.{' '}
                <Link to="/request-edit" className="link">
                  Request an edit
                </Link>
                .
              </InfoBox>
            ) : verifyError ? (
              <InfoBox variant="error">{verifyError}</InfoBox>
            ) : null}

            <div className="field" style={{ marginTop: '1.25rem' }}>
              <label htmlFor="verify-roll" className="field__label">
                Roll number <span className="field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="verify-roll"
                type="text"
                className="field__input"
                value={verifyRoll}
                onChange={(e) => setVerifyRoll(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={verifyLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>

            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="verify-email" className="field__label">
                Email address <span className="field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="verify-email"
                type="email"
                className="field__input"
                value={verifyEmail}
                onChange={(e) => setVerifyEmail(e.target.value)}
                autoComplete="email"
                disabled={verifyLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                className="btn btn--primary"
                onClick={handleVerify}
                disabled={verifyLoading}
                style={{ width: '100%' }}
              >
                {verifyLoading ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </div>
        </main>
        <HelpFooter />
      </div>
    );
  }

  // ── Render: edit form ─────────────────────────────────────────────────────
  if (!member || !expiresAt) return null;

  const domainDisplay = DOMAIN_MAP[member.domain_slug]?.name ?? member.domain_slug;
  const currentPhotoUrl = photoPreview ?? photoUrl(member.photo_path);

  // If PhotoStep is active, render it full-screen (inline overlay)
  if (showPhotoStep) {
    return (
      <div className="page">
        <GlobalBanners />
        <main id="main" className="container" style={{ padding: '1rem' }}>
          <PhotoStep
            onNext={handlePhotoNext}
            onBack={() => setShowPhotoStep(false)}
            existingBlob={photoBlob}
            existingPreviewUrl={photoPreview}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <GlobalBanners />
      <main id="main" className="container" style={{ padding: '2rem 1rem' }}>
        <div className="wizard-card" style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h1 className="wizard-step__title">Edit your details</h1>

          {/* Countdown banner */}
          <div style={{ marginBottom: '1.5rem' }}>
            <CountdownBanner expiresAt={expiresAt} />
          </div>

          {/* Global save error */}
          {saveError && (
            <div style={{ marginBottom: '1rem' }}>
              {saveError.includes('window ended') ? (
                <InfoBox variant="error">
                  {saveError}{' '}
                  <Link to="/request-edit" className="link">
                    Send a new request.
                  </Link>
                </InfoBox>
              ) : (
                <InfoBox variant="error">{saveError}</InfoBox>
              )}
            </div>
          )}

          {/* ── Locked fields ── */}
          <section aria-label="Locked fields" style={{ marginBottom: '1.5rem' }}>
            <LockedField label="Full name" value={member.full_name} />
            <LockedField label="Domain" value={domainDisplay} />
            <LockedField label="Roll number" value={member.roll_number} />
            <p
              className="field__hint"
              style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}
            >
              These fields are locked.{' '}
              <Link to="/request-edit" className="link">
                Request an edit
              </Link>{' '}
              if something is wrong.
            </p>
          </section>

          {/* ── Photo ── */}
          <div className="field" style={{ marginBottom: '1.25rem' }}>
            <span className="field__label">Photo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <img
                src={currentPhotoUrl}
                alt="Your current photo"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--color-border)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setShowPhotoStep(true)}
                >
                  Change photo
                </button>
                {photoBlob && (
                  <button
                    type="button"
                    className="btn btn--sm"
                    style={{ color: 'var(--color-error)' }}
                    onClick={handlePhotoRevert}
                  >
                    Remove / revert
                  </button>
                )}
              </div>
            </div>
            {fieldErrors.photo && (
              <p className="field__error" role="alert">
                {fieldErrors.photo}
              </p>
            )}
          </div>

          {/* ── Year ── */}
          <div className={`field${fieldErrors.year ? ' field--error' : ''}`} style={{ marginBottom: '1.25rem' }}>
            <span className="field__label">
              Year <span className="field__required" aria-hidden="true">*</span>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              {([1, 2, 3, 4] as const).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setYear(y);
                    setFieldErrors((prev) => ({ ...prev, year: undefined }));
                  }}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    border: `2px solid ${year === y ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: year === y ? 'var(--color-primary)' : 'transparent',
                    color: year === y ? '#fff' : 'inherit',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: year === y ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                  aria-pressed={year === y}
                >
                  {YEAR_LABELS[y]}
                </button>
              ))}
            </div>
            {fieldErrors.year && (
              <p className="field__error" role="alert">
                {fieldErrors.year}
              </p>
            )}
          </div>

          {/* ── Branch ── */}
          <div className={`field${fieldErrors.branch ? ' field--error' : ''}`} style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="edit-branch" className="field__label">
              Branch <span className="field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="edit-branch"
              className="field__input"
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                setFieldErrors((prev) => ({ ...prev, branch: undefined }));
              }}
            >
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            {fieldErrors.branch && (
              <p className="field__error" role="alert">
                {fieldErrors.branch}
              </p>
            )}
          </div>

          {/* ── Mobile number ── */}
          <div className={`field${fieldErrors.phone ? ' field--error' : ''}`} style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="edit-phone" className="field__label">
              Mobile number <span className="field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-phone"
              type="tel"
              inputMode="numeric"
              className="field__input"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              autoComplete="tel"
              maxLength={15}
            />
            {fieldErrors.phone && (
              <p className="field__error" role="alert">
                {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* ── Alternate mobile ── */}
          <div className={`field${fieldErrors.alt_phone ? ' field--error' : ''}`} style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="edit-alt-phone" className="field__label">
              Alternate mobile{' '}
              <span className="field__hint" style={{ fontWeight: 400 }}>
                (optional)
              </span>
            </label>
            <input
              id="edit-alt-phone"
              type="tel"
              inputMode="numeric"
              className="field__input"
              value={altPhone}
              onChange={(e) => {
                setAltPhone(e.target.value);
                setFieldErrors((prev) => ({ ...prev, alt_phone: undefined }));
              }}
              autoComplete="tel"
              maxLength={15}
            />
            {fieldErrors.alt_phone && (
              <p className="field__error" role="alert">
                {fieldErrors.alt_phone}
              </p>
            )}
          </div>

          {/* ── Email ── */}
          <div className={`field${fieldErrors.email ? ' field--error' : ''}`} style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="edit-email" className="field__label">
              Email address <span className="field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-email"
              type="email"
              className="field__input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              autoComplete="email"
              maxLength={254}
            />
            <p className="field__hint">
              You'll use your new email next time you check status.
            </p>
            {fieldErrors.email && (
              <p className="field__error" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* ── Save button ── */}
          <div style={{ marginTop: '2rem' }}>
            <button
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || isExpired}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </main>
      <HelpFooter />
    </div>
  );
}
