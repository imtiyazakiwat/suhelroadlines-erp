import React from 'react';
import './List.css';

/* =============================================================================
   Inset grouped list — the backbone of every iOS settings/detail screen, and
   the replacement for this app's HTML tables.

   ListSection  rounded card with an optional uppercase header and footer note
   ListRow      leading icon · title/subtitle · trailing value · chevron
   ListLink     a row that navigates (adds the chevron automatically)

   Separators inset to align with the title text, never full-bleed, and the
   last row never draws one.
   ========================================================================== */

export const ListSection = ({ header, footer, inset = true, className = '', children, ...rest }) => (
  <section className={`lst26 ${inset ? 'lst26--inset' : ''} ${className}`.trim()} {...rest}>
    {header && <h3 className="lst26__header">{header}</h3>}
    <div className="lst26__card">{children}</div>
    {footer && <p className="lst26__footer">{footer}</p>}
  </section>
);

export const ListRow = React.memo(React.forwardRef(
  (
    {
      as,
      icon = null,
      iconTone = 'neutral',
      thumbnail = null,
      title,
      subtitle,
      detail,
      value,
      valueTone = 'neutral',
      badge = null,
      accessory = null,
      chevron = false,
      destructive = false,
      onClick,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    const interactive = Boolean(onClick) || chevron;
    const Tag = as || (onClick ? 'button' : 'div');
    const tagProps = Tag === 'button' ? { type: 'button' } : {};

    return (
      <Tag
        ref={ref}
        className={[
          'lst26__row',
          interactive ? 'is-interactive' : '',
          destructive ? 'is-destructive' : '',
          className
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        {...tagProps}
        {...rest}
      >
        {thumbnail ? (
          <span className="lst26__thumb">
            <img src={thumbnail} alt="" loading="lazy" />
          </span>
        ) : icon ? (
          <span className={`lst26__icon lst26__icon--${iconTone}`}>{icon}</span>
        ) : null}

        <span className="lst26__text">
          {title && <span className="lst26__title">{title}</span>}
          {subtitle && <span className="lst26__subtitle">{subtitle}</span>}
          {detail && <span className="lst26__detail">{detail}</span>}
          {children}
        </span>

        {(value || badge || accessory) && (
          <span className="lst26__trailing">
            {value && <span className={`lst26__value lst26__value--${valueTone}`}>{value}</span>}
            {badge}
            {accessory}
          </span>
        )}

        {chevron && (
          <svg
            className="lst26__chevron"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="m9.5 5.5 7 6.5-7 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Tag>
    );
  }
));
ListRow.displayName = 'ListRow';

export const ListLink = React.forwardRef((props, ref) => <ListRow ref={ref} chevron {...props} />);
ListLink.displayName = 'ListLink';

export default ListSection;
