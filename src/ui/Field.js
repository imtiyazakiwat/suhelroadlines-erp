import React, { useId } from 'react';
import './Field.css';

/* =============================================================================
   Field wrapper + the text-entry family.

   Two layouts, matching iOS:
     'stacked'  label above the control — for forms with long values
     'row'      label left, value right-aligned — the inset grouped list style,
                used inside <ListSection>

   Every input is 16px minimum. Anything smaller makes mobile Safari zoom the
   viewport on focus, which is the single worst thing you can do to typing UX.
   ========================================================================== */

export const Field = ({ label, hint, error, layout = 'stacked', htmlFor, children, className = '' }) => (
  <div className={`fld fld--${layout} ${error ? 'is-invalid' : ''} ${className}`.trim()}>
    {label && (
      <label className="fld__label" htmlFor={htmlFor}>
        {label}
      </label>
    )}
    <div className="fld__control">{children}</div>
    {(error || hint) && <p className="fld__note">{error || hint}</p>}
  </div>
);

const useFieldId = (provided) => {
  const generated = useId();
  return provided || generated;
};

export const TextField = React.forwardRef(
  (
    {
      label,
      hint,
      error,
      layout,
      id,
      className = '',
      align,
      leading = null,
      trailing = null,
      clearable = false,
      onChange,
      value,
      ...rest
    },
    ref
  ) => {
    const fieldId = useFieldId(id);

    return (
      <Field label={label} hint={hint} error={error} layout={layout} htmlFor={fieldId}>
        <div className="fld__box">
          {leading && <span className="fld__affix">{leading}</span>}
          <input
            ref={ref}
            id={fieldId}
            className={`fld__input ${align ? `fld__input--${align}` : ''} ${className}`.trim()}
            value={value}
            onChange={onChange}
            aria-invalid={error ? true : undefined}
            {...rest}
          />
          {clearable && String(value ?? '').length > 0 && (
            <button
              type="button"
              className="fld__clear"
              aria-label="Clear"
              onClick={() => onChange?.({ target: { value: '' } })}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
          {trailing && <span className="fld__affix">{trailing}</span>}
        </div>
      </Field>
    );
  }
);
TextField.displayName = 'TextField';

/** Numeric entry with the right mobile keyboard and no spinner buttons. */
export const NumberField = React.forwardRef(({ decimal = false, ...rest }, ref) => (
  <TextField
    ref={ref}
    type="text"
    inputMode={decimal ? 'decimal' : 'numeric'}
    autoComplete="off"
    {...rest}
  />
));
NumberField.displayName = 'NumberField';

/** Currency entry: right-aligned, rupee prefix, digits only. */
export const CurrencyField = React.forwardRef(({ onChange, ...rest }, ref) => (
  <NumberField
    ref={ref}
    decimal
    align="right"
    leading={<span className="fld__unit">₹</span>}
    onChange={(e) => {
      const cleaned = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
      onChange?.({ ...e, target: { ...e.target, value: cleaned } });
    }}
    {...rest}
  />
));
CurrencyField.displayName = 'CurrencyField';

/** Indian mobile: 10 digits, numeric keypad.
 *  No maxLength on the input — paste can bring formatted text like
 *  "98765 43210" which exceeds 10 chars before the regex strips spaces.
 *  The onChange handler enforces the 10-digit limit after stripping. */
export const PhoneField = React.forwardRef(({ onChange, ...rest }, ref) => (
  <TextField
    ref={ref}
    type="tel"
    inputMode="numeric"
    autoComplete="tel"
    onChange={(e) =>
      onChange?.({ ...e, target: { ...e.target, value: e.target.value.replace(/\D/g, '').slice(0, 10) } })
    }
    {...rest}
  />
));
PhoneField.displayName = 'PhoneField';

export const DateField = React.forwardRef(({ label, hint, error, layout, id, ...rest }, ref) => {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} layout={layout} htmlFor={fieldId}>
      <div className="fld__box">
        <input ref={ref} id={fieldId} type="date" className="fld__input fld__input--date" {...rest} />
      </div>
    </Field>
  );
});
DateField.displayName = 'DateField';

export const TextArea = React.forwardRef(({ label, hint, error, id, rows = 3, ...rest }, ref) => {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <div className="fld__box fld__box--area">
        <textarea ref={ref} id={fieldId} rows={rows} className="fld__input fld__textarea" {...rest} />
      </div>
    </Field>
  );
});
TextArea.displayName = 'TextArea';

/** iOS search field: rounded fill, inline magnifier, inline clear. */
export const SearchField = React.forwardRef(
  ({ value, onChange, onClear, placeholder = 'Search', className = '', ...rest }, ref) => (
    <div className={`srch26 ${className}`.trim()}>
      <svg className="srch26__icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <input
        ref={ref}
        type="search"
        className="srch26__input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        enterKeyHint="search"
        {...rest}
      />
      {String(value ?? '').length > 0 && (
        <button
          type="button"
          className="srch26__clear"
          aria-label="Clear search"
          onClick={() => (onClear ? onClear() : onChange?.({ target: { value: '' } }))}
        >
          <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true" focusable="false">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}
    </div>
  )
);
SearchField.displayName = 'SearchField';

export default Field;
