import { useApp } from '../contexts/AppContext';

export function HelpFooter({
  title = 'Need a hand?',
  desc = 'Name not accepted, or something won’t load? Message the core team and we’ll sort it out.',
  whatsappOnly = false,
}: {
  title?: string;
  desc?: string;
  whatsappOnly?: boolean;
}) {
  const { settings } = useApp();

  const whatsappUrl =
    settings?.help_whatsapp_url ||
    (settings?.help_phone ? `https://wa.me/${settings.help_phone.replace(/[^0-9]/g, '')}` : null);
  const email = settings?.help_email;

  const hasAny = Boolean(whatsappUrl || (!whatsappOnly && email));

  return (
    <footer className="foot">
      <span className="foot__disc" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{desc}</p>
      <div className="foot__actions">
        {hasAny ? (
          <>
            {whatsappUrl && (
              <a
                className="btn btn--sun btn--sm"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg className="ic" aria-hidden="true">
                  <use href="#i-wa" />
                </svg>
                Message on WhatsApp
              </a>
            )}
            {!whatsappOnly && email && (
              <a className="btn btn--line btn--sm" href={`mailto:${email}`}>
                Send an email
              </a>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.9 }}>Please ask your domain lead.</p>
        )}
      </div>
    </footer>
  );
}
