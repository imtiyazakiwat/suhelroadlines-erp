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
  /**
   * Overrides the text on the trigger row.
   *
   * For a multi-select the trigger normally reads "2 selected". That is right
   * when the picker owns the value, and wrong when the chosen items are already
   * listed next to it — the trip form shows villages as removable chips, so the
   * count would be the same quantity stated twice, one row apart. Pass a summary
   * ("Choose", "Add more") to make the row read as the action it is. It renders
   * in the placeholder style deliberately: it is a prompt, not a value.
   */
  summary,
  searchable = false,
  searchPlaceholder = 'Search',
  onCreate,
  createLabel = 'Add',
  error,
  disabled = false,
  layout = 'stacked',
  multiple = false,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedValues = multiple ? value || [] : [];
  const selected = multiple ? null : options.find((option) => option.value === value);

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
    if (multiple) {
      // Toggle and keep the sheet open so several can be chosen in one visit.
      const next = selectedValues.includes(option.value)
        ? selectedValues.filter((item) => item !== option.value)
        : [...selectedValues, option.value];
      onChange?.(next, option);
      setQuery('');
      return;
    }

    onChange?.(option.value, option);
    close();
  };

  const isChosen = (option) =>
    multiple ? selectedValues.includes(option.value) : option.value === value;

  const computedText = multiple
    ? selectedValues.length
      ? `${selectedValues.length} selected`
      : placeholder
    : selected?.label || placeholder;

  const triggerText = summary || computedText;

  const hasValue = summary
    ? false
    : multiple
    ? selectedValues.length > 0
    : Boolean(selected);

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
          <span className={`pkr26__value ${hasValue ? '' : 'is-placeholder'}`}>{triggerText}</span>
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
        primaryAction={
          multiple ? (
            <button type="button" className="pkr26__done" onClick={close}>
              Done
            </button>
          ) : null
        }
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
                isChosen(option) ? (
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
              className={isChosen(option) ? 'is-checked' : ''}
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
