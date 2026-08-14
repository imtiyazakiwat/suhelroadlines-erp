/* =============================================================================
   Input normalisation, in one place.

   Every screen that accepts a vehicle number, a driver name, a village or a
   phone number goes through these. Previously each form did its own thing:
   Settings uppercased vehicle numbers on change, Add Trip only uppercased ones
   it created, and villages were never normalised at all — so "Bagalkot" and
   "bagalkot" became two separate villages that both appeared in the picker.

   The rule: normalise on the way in, so what the user sees typed is exactly
   what gets stored. Silent normalisation at save time is worse than none,
   because the value on screen and the value in the database disagree.
   ========================================================================== */

/** Collapse runs of whitespace and trim. */
export const tidy = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Vehicle numbers are uppercase by convention on every permit and STR, so the
 * field converts as you type rather than correcting you afterwards. Internal
 * spacing is collapsed but separators are kept: "ka 01 ab 1234" and
 * "KA-01-AB-1234" are both things people write, and we should not reformat what
 * they chose.
 */
export const normaliseVehicleNumber = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '');

/** Title Case for names of people and places: "ahmed khan" -> "Ahmed Khan". */
export const titleCase = (value) =>
  tidy(value)
    .toLowerCase()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (match, boundary, letter) => boundary + letter.toUpperCase());

/** Villages are stored Title Cased so the picker cannot show near-duplicates. */
export const normaliseVillageName = (value) => titleCase(value);

/**
 * Village codes are the short forms that go on paperwork. Uppercase letters and
 * digits only, capped at 6 — long enough to stay unique, short enough to sit in
 * a chip next to the name.
 */
export const normaliseVillageCode = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

/**
 * First three letters of the name, then a numeric suffix if that is taken.
 * A suggestion only — the field stays editable, because real codes follow local
 * convention more often than they follow the spelling.
 */
export const suggestVillageCode = (name, taken = []) => {
  const letters = String(name ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const base = letters.slice(0, 3) || 'VIL';

  const used = new Set(taken.filter(Boolean).map((code) => normaliseVillageCode(code)));
  if (!used.has(base)) return base;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = normaliseVillageCode(`${base}${suffix}`);
    if (!used.has(candidate)) return candidate;
  }
  return base;
};

/** Case-insensitive equality for names and codes. */
export const sameText = (a, b) => tidy(a).toLowerCase() === tidy(b).toLowerCase();

/**
 * Indian mobile validation. **Empty is valid** — a mobile number is optional
 * everywhere, because plenty of trips are booked without one and blocking the
 * whole form over a missing phone number was stopping real work.
 * A value that is present still has to be a real number.
 */
export const isValidMobile = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return true;
  return /^[6-9]\d{9}$/.test(digits);
};

/** The error string for a mobile field, or null when acceptable. */
export const mobileError = (value) =>
  isValidMobile(value) ? null : 'Enter a valid 10-digit mobile number, or leave it blank';

const textService = {
  tidy,
  titleCase,
  normaliseVehicleNumber,
  normaliseVillageName,
  normaliseVillageCode,
  suggestVillageCode,
  sameText,
  isValidMobile,
  mobileError
};

export default textService;
