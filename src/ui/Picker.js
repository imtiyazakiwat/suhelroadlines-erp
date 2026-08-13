import React, { useMemo, useState } from 'react';
import Sheet from './overlay/Sheet';
import { SearchField } from './Field';
import { ListRow } from './List';
import { EmptyState } from './Display';
import './Picker.css';

/* =============================================================================
   Picker — the replacement for every native <select> in the app.

   A tappable row shows the current value; tapping opens a sheet with the
   options. Optional search once the list gets long, and an "add new" affordance
   for the village field. Native selects can't be styled and render as an OS
   dropdown, which is what made the old forms feel non-native.
   ========================================================================== */

const Picker = ({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select',
  searchable = false,
  searchPlaceholder = 'Search',
  onCreate,
  createLabel = 'Add',
  error,
  disabled = false,
  layout = 'stacked',
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        String(option.subtitle ?? '').toLowerCase().includes(term)
    );
  }, [options, query]);

  const exactExists = filtered.some(
    (option) => option.label.toLowerCase() === query.trim().toLowerCase()
  );

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (option) => {
    onChange?.(option.value, option);
    close();
  };

  return (
    <>
      <div className={`pkr26 pkr26--${layout} ${error ? 'is-invalid' : ''} ${className}`.trim()}>
        {label && <span className="pkr26__label">{label}</span>}

        <button
          type="button"
          className="pkr26__trigger"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={`pkr26__value ${selected ? '' : 'is-placeholder'}`}>
            {selected?.label || placeholder}
          </span>
          <svg
            className="pkr26__chevrons"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="m7 10 5-4.5 5 4.5M7 14l5 4.5 5-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {error && <span className="pkr26__error">{error}</span>}
      </div>

      <Sheet
        open={open}
        onClose={close}
        title={label || 'Select'}
        detent={options.length > 7 || searchable ? 'medium' : 'auto'}
      >
        {searchable && (
          <div className="pkr26__search">
            <SearchField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              data-autofocus
            />
          </div>
        )}

        <div className="pkr26__options">
          {filtered.map((option) => (
            <ListRow
              key={option.value}
              title={option.label}
              subtitle={option.subtitle}
              onClick={() => pick(option)}
              accessory={
                option.value === value ? (
                  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
                    <path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null
              }
              className={option.value === value ? 'is-checked' : ''}
            />
          ))}

          {onCreate && query.trim() && !exactExists && (
            <ListRow
              title={`${createLabel} “${query.trim()}”`}
              className="pkr26__create"
              onClick={() => {
                const term = query.trim();
                close();
                onCreate(term);
              }}
            />
          )}

          {filtered.length === 0 && !onCreate && (
            <EmptyState title="No matches" message={`Nothing matched “${query.trim()}”.`} />
          )}
        </div>
      </Sheet>
    </>
  );
};

export default Picker;
