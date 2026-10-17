// Stepper.tsx — multi-step wizard progress indicator per spec §7.2
import React from 'react';

interface StepperProps {
  steps: string[];
  currentStep: number; // 1-indexed
  className?: string;
}

export function Stepper({ steps, currentStep, className = '' }: StepperProps) {
  const p = steps.length > 1 ? (currentStep - 1) / (steps.length - 1) : 0;

  return (
    <nav aria-label="Registration steps" className={`stepper ${className}`.trim()}>
      <div className="stepper__track">
        <i className="stepper__line" aria-hidden="true" />
        <i
          className="stepper__fill"
          aria-hidden="true"
          style={{ ['--p' as string]: p } as React.CSSProperties}
        />
        <ol>
          {steps.map((label, i) => {
            const stepNum = i + 1;
            const isDone = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            const stepClass = `st ${isActive ? 'st--active' : ''} ${isDone ? 'st--done' : ''}`.trim();

            return (
              <li
                key={label}
                className={stepClass}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="st__dot" aria-hidden="true">
                  {isDone ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </span>
                <span className="st__lbl">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
