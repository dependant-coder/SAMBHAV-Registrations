/**
 * src/components/admin/AdminFrame.tsx
 * Wrapper for the admin pages: the same riso tokens and components as the member app, but a wide column
 * instead of the 430px phone column. Use once per page, inside your existing admin layout.
 */
import type { ReactNode } from 'react';
import { Sprite, ToastProvider } from '../member/ui';
import '../../styles/admin.css';

export default function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="mapp-root adm">
        <Sprite />
        {children}
      </div>
    </ToastProvider>
  );
}

/** For dropping a piece into a page that already exists (your own admin layout): brings the toast, icons and scoped styles with it. */
export function AdminEmbed({ children, toast = true }: { children: ReactNode; toast?: boolean }) {
  const inner = <div className="mapp-root adm adm--embed">{toast && <Sprite />}{children}</div>;
  return toast ? <ToastProvider>{inner}</ToastProvider> : inner;
}

export function AdminHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className="adm__head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="h2">{title}</h1>
      </div>
      {right}
    </header>
  );
}
