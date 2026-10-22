import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PublicFrame({ step, children }: { step?: string; children: ReactNode }) {
  return (
    <div className="public">
      <header className="public-top">
        <Link to="/" className="brand">
          <span className="logo-dot" />
          Fahazavana
        </Link>
        {step && <span className="muted" style={{ fontSize: 14 }}>{step}</span>}
      </header>
      {children}
    </div>
  );
}
