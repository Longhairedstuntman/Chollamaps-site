import type { ReactNode } from 'react';
import { I } from '../shell/Icons';

/** The left panel, next to the rail: My Cholla, Explore, Layers, Account… one at a time. */
export default function Panel({ title, eyebrow, onClose, onBack, children, actions, wide }:
  { title: string; eyebrow?: string; onClose: () => void; onBack?: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  return (
    <section className={'panel' + (wide ? ' wide' : '')} aria-label={title}>
      <header className="panel-head">
        {onBack && <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">{I.back()}</button>}
        <div className="panel-title">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        {actions}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">{I.close()}</button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
