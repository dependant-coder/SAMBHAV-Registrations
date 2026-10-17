import type React from 'react';
import { Link } from 'react-router-dom';
import type { DomainConfig } from '../config';

interface DomainCardProps {
  domain: DomainConfig;
  registrationOpen: boolean;
  isWide?: boolean;
  colorClass?: 'blue' | 'sun' | 'pink' | 'mint';
}

const DOMAIN_GLYPHS: Record<string, React.ReactNode> = {
  management: (
    <svg className="tile__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden="true">
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="17" />
      <circle cx="32" cy="32" r="6" fill="currentColor" stroke="none" />
    </svg>
  ),
  documentation: (
    <svg className="tile__glyph" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <rect x="8" y="10" width="48" height="9" rx="4.5" />
      <rect x="8" y="28" width="34" height="9" rx="4.5" />
      <rect x="8" y="46" width="42" height="9" rx="4.5" />
    </svg>
  ),
  'pr-marketing': (
    <svg className="tile__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" aria-hidden="true">
      <path d="M24 56A16 16 0 0 0 8 40" />
      <path d="M40 56A32 32 0 0 0 8 24" />
      <path d="M56 56A48 48 0 0 0 8 8" />
      <circle cx="8" cy="56" r="5" fill="currentColor" stroke="none" />
    </svg>
  ),
  sponsorship: (
    <svg className="tile__glyph" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 6 58 32 32 58 6 32Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="9" fill="currentColor" />
    </svg>
  ),
  design: (
    <svg className="tile__glyph" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <circle cx="23" cy="32" r="20" fillOpacity=".62" />
      <circle cx="41" cy="32" r="20" fillOpacity=".62" />
    </svg>
  ),
  decoration: (
    <svg className="tile__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" aria-hidden="true">
      <rect x="13" y="13" width="38" height="38" rx="3" />
      <rect x="13" y="13" width="38" height="38" rx="3" transform="rotate(45 32 32)" />
      <circle cx="32" cy="32" r="5" fill="currentColor" stroke="none" />
    </svg>
  ),
  technical: (
    <svg className="tile__glyph" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <circle cx="32" cy="12" r="5" />
      <circle cx="52" cy="12" r="5" />
      <circle cx="12" cy="32" r="5" />
      <circle cx="32" cy="32" r="10" />
      <circle cx="52" cy="32" r="5" />
      <circle cx="12" cy="52" r="5" />
      <circle cx="32" cy="52" r="5" />
      <circle cx="52" cy="52" r="5" />
    </svg>
  ),
  media: (
    <svg className="tile__glyph" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M26 20v24l20-12Z" fill="currentColor" />
    </svg>
  ),
};

const DOMAIN_COLOR_CONFIG: Record<string, { bg: string; colorClass: 'blue' | 'sun' | 'pink' | 'mint'; text: string }> = {
  management: { bg: '#2B34F0', colorClass: 'blue', text: 'var(--paper)' },
  documentation: { bg: '#FFB81C', colorClass: 'sun', text: 'var(--ink)' },
  'pr-marketing': { bg: '#FF6FA8', colorClass: 'pink', text: 'var(--ink)' },
  sponsorship: { bg: '#35CDB2', colorClass: 'mint', text: 'var(--ink)' },
  design: { bg: '#2B34F0', colorClass: 'blue', text: 'var(--paper)' },
  decoration: { bg: '#FF6FA8', colorClass: 'pink', text: 'var(--ink)' },
  technical: { bg: '#FFB81C', colorClass: 'sun', text: 'var(--ink)' },
  media: { bg: '#35CDB2', colorClass: 'mint', text: 'var(--ink)' },
};

export function DomainCard({ domain, registrationOpen, isWide = false, colorClass }: DomainCardProps) {
  const glyph = DOMAIN_GLYPHS[domain.slug];
  const cfg = DOMAIN_COLOR_CONFIG[domain.slug] || {
    bg: domain.color || '#2B34F0',
    colorClass: colorClass || 'blue',
    text: (domain.color === '#2B34F0' || colorClass === 'blue') ? 'var(--paper)' : 'var(--ink)',
  };

  const resolvedColorClass = colorClass || cfg.colorClass;
  const tileClass = `tile tile--${resolvedColorClass} ${isWide ? 'tile--wide' : ''}`;

  return (
    <Link
      to={registrationOpen ? `/register/${domain.slug}` : '#'}
      className={tileClass}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
      }}
      aria-label={`Register for ${domain.name} domain`}
      onClick={(e) => !registrationOpen && e.preventDefault()}
    >
      {glyph}
      <span className="tile__name" style={{ color: cfg.text }}>{domain.name}</span>
      <span className="tile__desc" style={{ color: cfg.text }}>{domain.description}</span>
    </Link>
  );
}
