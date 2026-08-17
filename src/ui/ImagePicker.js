import React, { useRef, useState, useCallback } from 'react';
import { resizeAndUpload } from '../services/imageService';
import { Field } from './Field';
import './ImagePicker.css';

/* =============================================================================
   ImagePicker — optional image field for forms.

   Renders a tappable row: thumbnail preview when a URL exists, or a dashed
   placeholder when empty. Tapping opens the native file picker. On mobile the
   camera is offered as an option via capture="environment". The image is
   resized to ≤500 KB and uploaded to ImgBB client-side; the callback receives
   the hosted URL.

   Follows the Field.js contract: label, hint, error. Fits inside a ListRow.
   ========================================================================== */

const ImagePicker = ({ value, onChange, label, hint, error, disabled, className = '' }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      /* Reset the input so selecting the same file again fires onChange. */
      event.target.value = '';

      /* Validate type up front — don't upload a PDF and find out at ImgBB. */
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file');
        return;
      }

      setUploadError(null);
      setUploading(true);
      try {
        const result = await resizeAndUpload(file);
        onChange(result.url);
      } catch (err) {
        console.error('Image upload failed:', err);
        setUploadError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleClear = useCallback(
    (event) => {
      event.stopPropagation();
      onChange('');
      setUploadError(null);
    },
    [onChange]
  );

  return (
    <Field label={label} hint={hint} error={error || uploadError} className={`imgpkr ${className}`.trim()}>
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        className={`imgpkr__trigger ${value ? 'imgpkr__trigger--has-image' : ''} ${
          disabled || uploading ? 'imgpkr__trigger--disabled' : ''
        }`}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={value ? 'Change image' : 'Add image'}
      >
        {value ? (
          <img className="imgpkr__thumb" src={value} alt="" />
        ) : (
          <span className="imgpkr__placeholder">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}

        {uploading && (
          <span className="imgpkr__spinner" aria-label="Uploading">
            <span className="imgpkr__spinner-ring" />
          </span>
        )}

        {value && !uploading && !disabled && (
          <button
            type="button"
            className="imgpkr__clear"
            aria-label="Remove image"
            onClick={handleClear}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="imgpkr__input"
        onChange={handleFile}
        disabled={disabled || uploading}
        tabIndex={-1}
        aria-hidden="true"
      />
    </Field>
  );
};

export default ImagePicker;
