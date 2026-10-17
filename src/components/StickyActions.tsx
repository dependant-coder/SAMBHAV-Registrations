// StickyActions.tsx — sticky bottom action bar per spec §7.6
import React from 'react';

export function StickyActions({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`actions ${className}`}>{children}</div>;
}
