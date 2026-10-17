// ============================================================
// config.ts — OWNER-CONFIG: change these without touching components
// ============================================================

export const FEST_NAME = 'Sambhav 4.0';

// Year labels (1=FE … 4=BE)
export const YEAR_LABELS: Record<number, string> = {
  1: 'First Year (FE)',
  2: 'Second Year (SE)',
  3: 'Third Year (TE)',
  4: 'Final Year (BE)',
};

export type Tone = 'blue' | 'sun' | 'pink' | 'mint';

// Domain configuration — icons are emoji placeholders; replace with SVG paths if desired.
export interface DomainConfig {
  slug: string;
  name: string;
  description: string;
  /** Lucide icon name (see DomainCard.tsx for the lookup map) */
  icon: string;
  color: string;        // CSS hsl/hex for domain accent
  tone: Tone;
  glyph: string;        // glyph slug used for #g-<slug>
  whatsappUrl?: string; // OWNER-CONFIG: per-domain WhatsApp group link (leave empty to hide button)
}

export const DOMAINS: DomainConfig[] = [
  {
    slug: 'management',
    name: 'Management',
    description: 'Planning, coordination and operations',
    icon: 'clipboard',
    color: '#2B34F0',
    tone: 'blue',
    glyph: 'management',
    whatsappUrl: '',
  },
  {
    slug: 'documentation',
    name: 'Documentation',
    description: 'Records, reports and paperwork',
    icon: 'file-text',
    color: '#FFB81C',
    tone: 'sun',
    glyph: 'documentation',
    whatsappUrl: '',
  },
  {
    slug: 'pr-marketing',
    name: 'PR & Marketing',
    description: 'Outreach, promotion and social presence',
    icon: 'megaphone',
    color: '#FF6FA8',
    tone: 'pink',
    glyph: 'pr-marketing',
    whatsappUrl: '',
  },
  {
    slug: 'sponsorship',
    name: 'Sponsorship',
    description: 'Partners, funding and sponsor relations',
    icon: 'handshake',
    color: '#35CDB2',
    tone: 'mint',
    glyph: 'sponsorship',
    whatsappUrl: '',
  },
  {
    slug: 'design',
    name: 'Design',
    description: 'Posters, branding and visuals',
    icon: 'pen-tool',
    color: '#2B34F0',
    tone: 'blue',
    glyph: 'design',
    whatsappUrl: '',
  },
  {
    slug: 'decoration',
    name: 'Decoration',
    description: 'Venue look, stage and installations',
    icon: 'sparkles',
    color: '#FF6FA8',
    tone: 'pink',
    glyph: 'decoration',
    whatsappUrl: '',
  },
  {
    slug: 'technical',
    name: 'Technical',
    description: 'Website, tech events and tooling',
    icon: 'cpu',
    color: '#FFB81C',
    tone: 'sun',
    glyph: 'technical',
    whatsappUrl: '',
  },
  {
    slug: 'media',
    name: 'Media',
    description: 'Photography, video and coverage',
    icon: 'camera',
    color: '#35CDB2',
    tone: 'mint',
    glyph: 'media',
    whatsappUrl: '',
  },
];

// Map slug → config for O(1) lookup
export const DOMAIN_MAP: Record<string, DomainConfig> = Object.fromEntries(
  DOMAINS.map(d => [d.slug, d])
);

// All valid domain slugs (for route validation)
export const VALID_DOMAIN_SLUGS = new Set(DOMAINS.map(d => d.slug));

// Roll number helper text (OWNER-CONFIG: update example when real format is confirmed)
export const ROLL_EXAMPLE = '21CO101';

// Feature flags
export const FEATURE_FLAGS = {
  turnstileEnabled: Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
};

// Draft TTL in milliseconds (24 hours)
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

// Photo constraints
export const PHOTO = {
  maxFileSizeMB: 15,
  minShortSidePx: 400,
  outputSizePx: 800,
  outputQuality: 0.85,
  outputQualitySteps: [0.75, 0.65, 0.55],
  maxOutputBytes: 400 * 1024, // 400 KB
};

// Submission timeouts (ms)
export const TIMEOUT = {
  upload: 60_000,
  rpc: 20_000,
};

// Common email typo corrections
export const EMAIL_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'hotmial.com': 'hotmail.com',
};
