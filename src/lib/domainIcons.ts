// domainIcons.ts — single source of truth for domain icon key → Lucide component
// Used by DomainCard.tsx, overview.tsx, and any other component that renders domain icons.
// Keep in sync with the icon keys in config.ts.

import {
  Clipboard, FileText, Megaphone, Handshake,
  PenTool, Sparkles, Cpu, Camera,
  type LucideIcon,
} from 'lucide-react';

export const DOMAIN_ICON_MAP: Record<string, LucideIcon> = {
  'clipboard': Clipboard,
  'file-text': FileText,
  'megaphone': Megaphone,
  'handshake': Handshake,
  'pen-tool':  PenTool,
  'sparkles':  Sparkles,
  'cpu':       Cpu,
  'camera':    Camera,
};

/** Resolves a domain icon key to its Lucide component, falling back to Clipboard. */
export function getDomainIcon(iconKey: string): LucideIcon {
  return DOMAIN_ICON_MAP[iconKey] ?? Clipboard;
}
