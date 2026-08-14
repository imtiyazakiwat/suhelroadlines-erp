import React from 'react';
import './motion.css';

export { default as RouteTransition } from './RouteTransition';

/**
 * Stagger — children arrive in sequence rather than all at once.
 * Sets the --i custom property that motion.css turns into a delay.
 */
export const Stagger = ({ as: Tag = 'div', from = 0, className = '', children, ...rest }) => (
  <Tag className={`stg26 ${className}`.trim()} {...rest}>
    {React.Children.map(children, (child, index) =>
      React.isValidElement(child)
        ? React.cloneElement(child, {
            style: { '--i': index + from, ...(child.props.style || {}) }
          })
        : child
    )}
  </Tag>
);

/** Content that has just loaded: fades and settles instead of popping in. */
export const Appear = ({ as: Tag = 'div', className = '', children, ...rest }) => (
  <Tag className={`appear26 ${className}`.trim()} {...rest}>
    {children}
  </Tag>
);
