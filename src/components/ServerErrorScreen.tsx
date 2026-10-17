// ServerErrorScreen.tsx — startup error screen per spec §6.2

interface ServerErrorScreenProps {
  onRetry: () => void;
}

export function ServerErrorScreen({ onRetry }: ServerErrorScreenProps) {
  return (
    <div className="fullscreen-center">
      <div className="error-screen">
        <div className="error-screen__icon" aria-hidden="true">📡</div>
        <h1 className="error-screen__title">Can't reach the server</h1>
        <p className="error-screen__desc">
          Check your internet connection and try again.
          If the problem persists, the server may be temporarily unavailable.
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onRetry}
          style={{ marginTop: '1.5rem' }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
