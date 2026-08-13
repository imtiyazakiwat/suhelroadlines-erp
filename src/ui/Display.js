import React from 'react';
import './Display.css';

/* =============================================================================
   Small display primitives: Card, SectionHeader, Badge, Chip, Switch,
   EmptyState, Skeleton, Divider, Stat.
   These replace the 45 duplicated class names found across the old screens.
   ========================================================================== */

export const Card = ({ inset = true, padded = true, className = '', children, ...rest }) => (
  <div
    className={`card26 ${inset ? 'card26--inset' : ''} ${padded ? 'card26--padded' : ''} ${className}`.trim()}
    {...rest}
  >
    {children}
  </div>
);

export const SectionHeader = ({ title, action, onAction, actionLabel = 'View All', className = '' }) => (
  <div className={`shdr26 ${className}`.trim()}>
    <h2 className="shdr26__title">{title}</h2>
    {(action || onAction) &&
      (action || (
        <button type="button" className="shdr26__action" onClick={onAction}>
          {actionLabel}
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              d="M4.5 12h13m-5-5.5 5.5 5.5-5.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
  </div>
);

export const Badge = ({ tone = 'neutral', dot = false, className = '', children }) => (
  <span className={`bdg26 bdg26--${tone} ${className}`.trim()}>
    {dot && <span className="bdg26__dot" aria-hidden="true" />}
    {children}
  </span>
);

export const Chip = ({ onRemove, onClick, selected = false, className = '', children, ...rest }) => {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className={`chp26 ${selected ? 'is-selected' : ''} ${className}`.trim()}
      onClick={onClick}
      {...(onClick ? { type: 'button' } : {})}
      {...rest}
    >
      <span className="chp26__label">{children}</span>
      {onRemove && (
        <button
          type="button"
          className="chp26__remove"
          aria-label={`Remove ${typeof children === 'string' ? children : 'item'}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true" focusable="false">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}
    </Tag>
  );
};

/** iOS switch: 51×31, thumb travels 20px, spring timing. */
export const Switch = ({ checked = false, onChange, disabled = false, label, id, className = '' }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`swt26 ${checked ? 'is-on' : ''} ${className}`.trim()}
    onClick={() => onChange?.(!checked)}
  >
    <span className="swt26__thumb" aria-hidden="true" />
  </button>
);

export const EmptyState = ({ icon, title, message, action, className = '' }) => (
  <div className={`empt26 ${className}`.trim()}>
    {icon && <span className="empt26__icon">{icon}</span>}
    {title && <h3 className="empt26__title">{title}</h3>}
    {message && <p className="empt26__message">{message}</p>}
    {action && <div className="empt26__action">{action}</div>}
  </div>
);

export const Skeleton = ({ height = 16, width = '100%', radius = 'var(--r-sm)', className = '', style }) => (
  <span
    className={`skel26 ${className}`.trim()}
    style={{ height, width, borderRadius: radius, ...style }}
    aria-hidden="true"
  />
);

export const Divider = ({ inset = false }) => (
  <span className={`div26 ${inset ? 'div26--inset' : ''}`} aria-hidden="true" />
);

/** Big number + caption, with an optional coloured status dot. */
export const Stat = ({ value, label, tone = 'neutral', dot = false, className = '' }) => (
  <div className={`stat26 ${className}`.trim()}>
    <span className="stat26__value">
      {dot && <span className={`stat26__dot stat26__dot--${tone}`} aria-hidden="true" />}
      {value}
    </span>
    <span className="stat26__label">{label}</span>
  </div>
);

export default Card;
