// InfoBox.tsx — riso note component per spec §7.5
import React from 'react';

interface InfoBoxProps {
  variant?: 'info' | 'warning' | 'success' | 'error';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function InfoBox({
  variant = 'info',
  children,
  className = '',
  style,
  id,
}: InfoBoxProps) {
  const modifier =
    variant === 'warning'
      ? 'note--warn'
      : variant === 'error'
      ? 'note--err'
      : variant === 'success'
      ? 'note--ok'
      : '';

  const role = variant === 'error' ? 'alert' : 'note';

  return (
    <div
      id={id}
      className={`note ${modifier} ${className}`.trim()}
      style={style}
      role={role}
    >
      <span className="note__ic" aria-hidden="true">
        {variant === 'info' || variant === 'success' ? 'i' : '!'}
      </span>
      <div>{children}</div>
    </div>
  );
}
