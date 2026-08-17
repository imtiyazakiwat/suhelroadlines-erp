import React, { useRef, useState, useCallback, useMemo } from 'react';
import { resizeAndUpload } from '../services/imageService';
import { Field } from './Field';
import './ImagePicker.css';

/* =============================================================================
   ImagePicker — optional multi-image field for forms.

   Accepts `value` as an array of hosted URLs and fires `onChange(nextArray)`
   on every add/remove.  Shows thumbnails in a grid with per-image remove
   buttons and an "add" slot.  Max 5 images by default (configurable via
   `maxImages`).

   Follows the Field.js contract: label, hint, error.  Fits inside a ListRow.
   ========================================================================== */

const MAX_IMAGES = 5;

const ImagePicker = ({ value = [], onChange, label, hint, error, disabled, maxImages = MAX_IMAGES, className = '' }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const images = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const canAdd = images.length < maxImages && !disabled && !uploading;

  const handleFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      /* Reset the input so selecting the same file again fires onChange. */
      event.target.value = '';

      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file');
        return;
      }

      setUploadError(null);
      setUploading(true);
      try {
        const result = await resizeAndUpload(file);
        onChange([...images, result.url]);
      } catch (err) {
        console.error('Image upload failed:', err);
        setUploadError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [images, onChange]
  );

  const handleRemove = useCallback(
    (index) => {
      const next = images.filter((_, i) => i !== index);
      onChange(next);
    },
    [images, onChange]
  );

  return (
    <Field label={label} hint={hint} error={error || uploadError} className={`imgpkr ${className}`.trim()}>
      <div className="imgpkr__grid">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="imgpkr__tile">
            <img className="imgpkr__thumb" src={url} alt="" loading="lazy" />
            {!disabled && (
              <button
                type="button"
                className="imgpkr__remove"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => handleRemove(i)}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <div
            role="button"
            tabIndex={0}
            className="imgpkr__add"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            aria-label="Add image"
          >
            {uploading ? (
              <span className="imgpkr__spinner-ring" />
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </svg>
            )}
          </div>
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
