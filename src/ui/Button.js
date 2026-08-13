import React from 'react';
import GlassSurface from './glass/GlassSurface';
import './Button.css';

/* =============================================================================
   Button — the five iOS button styles.

     filled   solid accent fill, the one primary action on a screen
     tinted   accent text on a translucent accent wash
     gray     neutral fill, secondary actions
     plain    text only, tertiary / inline
     glass    Liquid Glass, for buttons that float over content

   iOS never uses a hover state as the primary affordance; press is a scale +
   dim. Destructive actions colour the label red rather than the fill.
   ========================================================================== */

const Button = React.forwardRef(
  (
    {
      variant = 'gray',
      size = 'md',
      role: intent = 'normal',
      block = false,
      loading = false,
      disabled = false,
      icon = null,
      iconTrailing = null,
      capsule = false,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const classes = [
      'btn26',
      `btn26--${variant}`,
      `btn26--${size}`,
      intent !== 'normal' ? `btn26--${intent}` : '',
      block ? 'btn26--block' : '',
      capsule ? 'btn26--capsule' : '',
      loading ? 'is-loading' : '',
      className
    ]
      .filter(Boolean)
      .join(' ');

    const body = (
      <>
        {loading && <span className="btn26__spinner" aria-hidden="true" />}
        {!loading && icon && <span className="btn26__icon">{icon}</span>}
        {children && <span className="btn26__label">{children}</span>}
        {!loading && iconTrailing && <span className="btn26__icon">{iconTrailing}</span>}
      </>
    );

    if (variant === 'glass') {
      return (
        <GlassSurface
          as="button"
          ref={ref}
          capsule={capsule}
          radius={capsule ? undefined : 14}
          interactive
          className={classes}
          type={type}
          disabled={disabled || loading}
          aria-busy={loading || undefined}
          {...rest}
        >
          {body}
        </GlassSurface>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {body}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
