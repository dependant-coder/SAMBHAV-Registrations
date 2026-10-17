// NotFound.tsx — spec §9.6
import { Link } from 'react-router-dom';
import { GlobalBanners } from '../components/Banner';

export default function NotFound() {
  return (
    <div className="page">
      <GlobalBanners />
      <main id="main" className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p className="notfound__code" aria-hidden="true">404</p>
        <h1 className="notfound__title">Page not found</h1>
        <p className="notfound__desc">
          The page you're looking for doesn't exist or the link may be outdated.
        </p>
        <Link to="/" className="btn btn--primary" style={{ display: 'inline-flex', marginTop: '1.5rem' }}>
          ← Go to home
        </Link>
      </main>
    </div>
  );
}
