/* =============================================================================
   Image upload service — ImgBB client-side upload with canvas resize.

   The upload runs in the browser, so the ImgBB API key is sent from the
   end-user's IP, not from the server. The key is inlined by CRA via
   REACT_APP_IMGBB_KEY and must be set in .env.local.

   Images are resized on a canvas to fit within maxBytes before upload. The
   aspect ratio is preserved; EXIF orientation is handled by the browser's
   drawImage. No server round-trip is needed.
   ========================================================================== */

const IMGBB_ENDPOINT = 'https://api.imgbb.com/1/upload';

const getApiKey = () => process.env.REACT_APP_IMGBB_KEY || '';

/* ---------------------------------------------------------------------------
   Resize

   Draws the image onto a canvas, scaling down iteratively until the Blob is
   within maxBytes. Starts at quality 0.85 and drops to 0.6 on the second
   pass; after that it reduces dimensions. Most phone photos land under
   500 KB in one pass at 0.85.
   ----------------------------------------------------------------------- */
export const resizeImage = (file, maxBytes = 500_000) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.onload = () => {
        let { width, height } = img;

        /* Cap the initial dimensions so we don't allocate a huge canvas for a
           48 MP phone camera. */
        const MAX_DIM = 2048;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const tryEncode = (quality) =>
          new Promise((res) =>
            canvas.toBlob((blob) => res(blob), 'image/jpeg', quality)
          );

        const encode = async () => {
          let blob = await tryEncode(0.85);
          if (blob.size <= maxBytes) return blob;

          blob = await tryEncode(0.6);
          if (blob.size <= maxBytes) return blob;

          /* Still too large — halve the dimensions and try again. */
          let w = Math.round(width / 2);
          let h = Math.round(height / 2);
          while (w > 100 && h > 100) {
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            blob = await tryEncode(0.7);
            if (blob.size <= maxBytes) return blob;
            w = Math.round(w / 2);
            h = Math.round(h / 2);
          }
          return blob;
        };

        encode().then(resolve, reject);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

/* ---------------------------------------------------------------------------
   Upload

   Posts the resized Blob to ImgBB and returns the URL + metadata. The album
   parameter routes uploads to the shared Suhel Roadlines album.
   ----------------------------------------------------------------------- */
export const uploadToImgbb = async (blob, { name } = {}) => {
  const key = getApiKey();
  if (!key) throw new Error('ImgBB API key is not configured');

  const form = new FormData();
  form.append('key', key);
  form.append('image', blob);
  if (name) form.append('name', name);

  const response = await fetch(`${IMGBB_ENDPOINT}?key=${key}`, {
    method: 'POST',
    body: form
  });

  const json = await response.json();

  if (!json.success) {
    const msg = json?.error?.message || 'Image upload failed';
    throw new Error(msg);
  }

  return {
    url: json.data.url,
    displayUrl: json.data.display_url,
    deleteUrl: json.data.delete_url,
    thumbUrl: json.data.thumb?.url || json.data.url,
    width: Number(json.data.width),
    height: Number(json.data.height),
    size: Number(json.data.size)
  };
};

/* ---------------------------------------------------------------------------
   Convenience: resize + upload in one call.
   ----------------------------------------------------------------------- */
export const resizeAndUpload = async (file, { maxBytes, name } = {}) => {
  const blob = await resizeImage(file, maxBytes);
  return uploadToImgbb(blob, { name });
};
