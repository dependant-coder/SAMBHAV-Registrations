// Field.tsx — accessible form field with riso-styled label, control, prefix, tick & error
import React, { useEffect, useId, useRef, useState } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  valid?: boolean;
  prefix?: string;
  bare?: boolean;
  invalid?: boolean;
  children: (props: { id: string; 'aria-describedby': string; 'aria-invalid': boolean }) => React.ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  required,
  optional,
  valid,
  prefix,
  bare = false,
  invalid = false,
  children,
  className = '',
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');

  const [shaking, setShaking] = useState(false);
  const prevErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prevErrorRef.current && (error || invalid) && !hasReducedMotion) {
      setShaking(true);
    }
    prevErrorRef.current = error || (invalid ? 'invalid' : undefined);
  }, [error, invalid]);

  const isError = Boolean(error || invalid);

  return (
    <div
      className={`field ${isError ? 'field--err' : ''} ${valid ? 'is-valid' : ''} ${className}`.trim()}
    >
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
        {optional && <span className="opt">Optional</span>}
      </label>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}

      {bare ? (
        children({
          id,
          'aria-describedby': describedBy,
          'aria-invalid': isError,
        })
      ) : (
        <div
          className={`control ${shaking ? 'shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          {prefix && (
            <span className="pre" aria-hidden="true">
              {prefix}
            </span>
          )}
          {children({
            id,
            'aria-describedby': describedBy,
            'aria-invalid': isError,
          })}
          <span className="ok" aria-hidden="true">
            <svg className="ic">
              <use href="#i-check" />
            </svg>
          </span>
        </div>
      )}

      {error && (
        <p id={errorId} className="err" role="alert">
          <svg className="ic" aria-hidden="true">
            <use href="#i-alert" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
