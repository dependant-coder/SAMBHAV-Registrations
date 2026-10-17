// DomainBand.tsx — domain poster band header per spec §7.1
import { Link } from 'react-router-dom';

interface DomainBandProps {
  slug?: string;
  name?: string;
  eyebrow?: string;
  title?: string;
  showChange?: boolean;
}

export function DomainBand({
  slug,
  name = '',
  eyebrow = 'Registering for',
  title,
  showChange = true,
}: DomainBandProps) {
  const displayTitle = title || name;
  const isLong = displayTitle.length > 11;

  return (
    <header className="band">
      <i className="bd bd--a" aria-hidden="true" />
      <i className="bd bd--b" aria-hidden="true" />
      {slug && (
        <svg className="band__mark" aria-hidden="true" viewBox="0 0 64 64">
          <use href={`#g-${slug}`} />
        </svg>
      )}

      <div className="band__top">
        <Link to="/" className="chip" aria-label="Back to home">
          <svg className="ic" aria-hidden="true">
            <use href="#i-arrow-l" />
          </svg>
          Home
        </Link>
        <Link to="/" className="brand" aria-label="Sambhav 4.0 home">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle className="a" cx="13" cy="18" r="12" />
            <circle className="b" cx="23" cy="18" r="12" />
          </svg>
          Sambhav 4.0
        </Link>
      </div>

      <p className="band__eyebrow">{eyebrow}</p>
      <h1 className={`band__title ${isLong ? 'is-long' : ''}`}>{displayTitle}</h1>
      {showChange && (
        <Link to="/" className="band__change" aria-label="Change domain">
          Change domain
        </Link>
      )}
    </header>
  );
}
