/**
 * src/components/MemberLoginLink.tsx
 * The way into the members app from the public site. Drop it on the Home page (and the Success page):
 *   <MemberLoginLink />                      full card: "Already registered? Open the members app"
 *   <MemberLoginLink variant="button" />     just the button (for the header or a tight spot)
 * Self-contained styles (inline) so it fits any page and cannot be affected by, or affect, other CSS.
 */
import { Link } from 'react-router-dom';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, padding: '0 22px',
  borderRadius: 999, background: '#2B34F0', color: '#ECEEF8', font: '800 16px/1 inherit', textDecoration: 'none',
  border: '2px solid #14123A', boxShadow: '3px 3px 0 #14123A',
};

export default function MemberLoginLink({ variant = 'card' }: { variant?: 'card' | 'button' }) {
  if (variant === 'button') {
    return <Link to="/app/login" style={btn}>Members login</Link>;
  }
  return (
    <section
      aria-label="Members app"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        margin: '24px auto 0', maxWidth: 560, padding: '18px 20px', borderRadius: 24,
        background: '#FFB81C', color: '#14123A', border: '2px solid #14123A', boxShadow: '4px 4px 0 #14123A',
      }}
    >
      <div style={{ flex: '1 1 220px' }}>
        <strong style={{ display: 'block', fontSize: 18 }}>Already registered?</strong>
        <span style={{ fontSize: 15 }}>Open the members app for announcements, events and your ID card.</span>
      </div>
      <Link to="/app/login" style={btn}>Open members app</Link>
    </section>
  );
}
