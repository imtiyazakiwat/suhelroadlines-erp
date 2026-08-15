import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, villageService } from '../../services/firebaseService';
import { createTripEntry } from '../../types';
import { format } from 'date-fns';
import {
  Card,
  Chip,
  ListSection,
  ListRow,
  Picker,
  Segmented,
  TextField,
  PhoneField,
  CurrencyField,
  NumberField,
  DateField,
  useToast
} from '../../ui';
import useCommitAction from '../Layout/useCommitAction';
import {
  normaliseVehicleNumber,
  formatVehicleNumber,
  normaliseVillageName,
  suggestVillageCode,
  titleCase,
  mobileError,
  sameText
} from '../../services/textService';
import { TruckIcon } from '../Common/Icons';
import './AddEntryForm.css';

/* Modelled on Calendar's New Event: Cancel and Save in the nav bar, an identity
   header, then meaning-grouped sections. Nothing is a bare label-over-input;
   every row is an inset grouped row with the value right-aligned. */

const VEHICLE_TYPES = [
  { value: 'lorry', label: 'Lorry' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'pickup', label: 'Pickup' }
];

const STR_OPTIONS = [
  { value: 'not received', label: 'Due' },
  { value: 'Received', label: 'Received' }
];

const AddEntryForm = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    slNumber: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    vehicleNumber: '',
    strNumber: 'not received',
    vehicleType: 'lorry',
    villages: [],
    quantity: '',
    driverName: '',
    mobileNumber: '',
    advanceAmount: ''
  });

  const [vehicles, setVehicles] = useState([]);
  const [allVillages, setAllVillages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;

    tripService
      .getNextSlNumber()
      .then((next) => {
        if (!cancelled) {
          setFormData((prev) =>
            // Never clobber a number the user has already typed.
            prev.slNumber ? prev : { ...prev, slNumber: String(next).padStart(4, '0') }
          );
        }
      })
      .catch((error) => console.error('Error getting next SL number:', error));

    vehicleService
      .getAllVehicles()
      .then((list) => !cancelled && setVehicles(list || []))
      .catch((error) => console.error('Error loading vehicles:', error));

    villageService
      .getAllVillages()
      .then((list) => !cancelled && setAllVillages(list || []))
      .catch((error) => console.error('Error loading villages:', error));

    return () => {
      cancelled = true;
    };
  }, []);

  const setField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  }, []);

  /* Own lorries first, and labelled, because they are the ones dispatched most
     and the ones whose number is being looked for. The marker goes in the
     subtitle rather than the label so the label stays exactly the number — the
     Picker matches typed text against both, so "my" finds the own fleet. */
  const vehicleOptions = useMemo(() => {
    const toOption = (vehicle) => ({
      value: vehicle.vehicleNumber,
      label: formatVehicleNumber(vehicle.vehicleNumber),
      subtitle:
        [vehicle.isOwn === true ? 'My vehicle' : null, vehicle.driverName, vehicle.mobileNumber]
          .filter(Boolean)
          .join(' · ') || undefined
    });

    const options = [
      ...vehicles.filter((vehicle) => vehicle.isOwn === true).map(toOption),
      ...vehicles.filter((vehicle) => vehicle.isOwn !== true).map(toOption)
    ];

    /* A number typed in rather than chosen is not in the list, and the Picker
       shows its placeholder for a value it cannot find — so entering a brand new
       vehicle left the field reading "Select vehicle" as if nothing had been
       entered. Adding it as an option makes the choice visible. */
    if (
      formData.vehicleNumber &&
      !options.some((option) => sameText(option.value, formData.vehicleNumber))
    ) {
      options.unshift({
        value: formData.vehicleNumber,
        label: formatVehicleNumber(formData.vehicleNumber),
        subtitle: 'New vehicle'
      });
    }

    return options;
  }, [vehicles, formData.vehicleNumber]);

  const villageOptions = useMemo(
    () =>
      allVillages.map((village) => ({
        value: village.villageName,
        label: village.villageName,
        // The code is what appears on the paperwork, so it is worth showing here
        // and it makes the picker searchable by either.
        subtitle: [village.code, `used ${village.usageCount || 0}×`]
          .filter(Boolean)
          .join(' · ')
      })),
    [allVillages]
  );

  /** Picking a known vehicle carries its driver, mobile and type across. */
  const handleVehiclePick = (vehicleNumber) => {
    const vehicle = vehicles.find((item) => item.vehicleNumber === vehicleNumber);
    setFormData((prev) => ({
      ...prev,
      vehicleNumber,
      driverName: vehicle?.driverName || prev.driverName,
      mobileNumber: vehicle?.mobileNumber || prev.mobileNumber,
      // Type came across as whatever the segmented control happened to be
      // showing, and the save path writes the form's type back to the vehicle —
      // so picking a tempo and saving quietly reclassified it as a lorry.
      vehicleType: vehicle?.vehicleType || prev.vehicleType
    }));
    setErrors((prev) => ({ ...prev, vehicleNumber: null }));
  };

  /**
   * A number typed in rather than chosen. Nothing is written yet — the vehicle is
   * created as part of saving the trip, so a half-entered form leaves no record
   * behind.
   *
   * The driver fields are cleared, not left alone: picking KA 01 prefilled its
   * driver, and typing a different number afterwards carried that driver across
   * and then saved him onto the new vehicle. A number that is already on file
   * (reached here when the spelling differs only by case) still prefills.
   */
  const handleVehicleCreate = (vehicleNumber) => {
    const number = normaliseVehicleNumber(vehicleNumber);
    const known = vehicles.find((item) => sameText(item.vehicleNumber, number));

    setFormData((prev) => ({
      ...prev,
      vehicleNumber: number,
      driverName: known?.driverName || '',
      mobileNumber: known?.mobileNumber || '',
      vehicleType: known?.vehicleType || prev.vehicleType
    }));
    setErrors((prev) => ({ ...prev, vehicleNumber: null }));
  };

  const handleVillagesChange = (next, option) => {
    setField('villages', next);
    // Usage count drives the ordering of the village list; fire and forget.
    if (option && next.includes(option.value)) {
      const village = allVillages.find((item) => item.villageName === option.value);
      if (village?.id) villageService.updateVillageUsage(village.id).catch(() => {});
    }
  };

  const handleVillageCreate = async (raw) => {
    const villageName = normaliseVillageName(raw);
    if (!villageName) return;

    // Case-insensitive, because "bagalkot" and "Bagalkot" are one village. The
    // old check was exact-match, which is how the list filled up with
    // near-duplicates that all showed in the picker.
    const existing = allVillages.find((item) => sameText(item.villageName, villageName));
    const canonical = existing?.villageName || villageName;

    if (formData.villages.some((item) => sameText(item, canonical))) return;

    // Optimistic: the chip appears immediately, Firestore catches up.
    setField('villages', [...formData.villages, canonical]);
    if (existing) return;

    try {
      const created = await villageService.addVillage({
        villageName,
        code: suggestVillageCode(
          villageName,
          allVillages.map((item) => item.code)
        ),
        isActive: true,
        usageCount: 1
      });
      setAllVillages((prev) => [...prev, created]);
    } catch (error) {
      console.error('Error adding new village:', error);
      toast.error(`Could not save “${villageName}”`);
    }
  };

  const removeVillage = (villageName) =>
    setField(
      'villages',
      formData.villages.filter((item) => item !== villageName)
    );

  const validate = () => {
    const next = {};

    /* Two fields are genuinely required: which vehicle, and where it is going.
       Everything else either has a working default or is optional.

       The STR-status and vehicle-type checks that used to sit here could never
       fire — both are set from a Segmented control that is always on one of its
       options and both default in the service — so they were two more strings to
       read past on a form people fill in twenty times a day. */
    if (!formData.vehicleNumber.trim()) next.vehicleNumber = 'Vehicle number is required';
    if (formData.villages.length === 0) next.villages = 'Add at least one village';

    // Driver name and mobile are both optional: plenty of trips are booked
    // before the driver is assigned, and refusing to save the whole trip over a
    // missing name or phone number blocked real work. A mobile number that *is*
    // entered still has to be a real one.
    const mobileProblem = mobileError(formData.mobileNumber);
    if (mobileProblem) next.mobileNumber = mobileProblem;

    if (formData.advanceAmount && parseFloat(formData.advanceAmount) < 0)
      next.advanceAmount = 'Advance cannot be negative';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Reachable two ways now: the nav bar Save button, and implicit form
  // submission from the keyboard. Only the latter carries an event.
  const handleSubmit = async (event) => {
    if (event) event.preventDefault();

    if (!validate()) {
      toast.error('Check the highlighted fields');
      return;
    }

    setSaving(true);
    const startedAt = performance.now();

    try {
      const number = formatVehicleNumber(formData.vehicleNumber);

      const tripData = createTripEntry({
        slNumber: parseInt(formData.slNumber, 10),
        date: new Date(formData.date),
        vehicleNumber: number,
        strNumber: formData.strNumber.trim(),
        vehicleType: formData.vehicleType,
        villages: formData.villages,
        quantity: parseFloat(formData.quantity),
        driverName: titleCase(formData.driverName),
        mobileNumber: formData.mobileNumber.trim(),
        advanceAmount: parseFloat(formData.advanceAmount) || 0
      });

      // The trip, and — when an amount was entered — its opening advance, which
      // tripService.addTrip writes as an `initial` advance in the same pass. That
      // is the whole reason the amount is on this form: the ledger stays correct
      // without a second trip to Add Advance.
      await tripService.addTrip(tripData);

      /* Book-keeping, in its own try: the trip is already saved by this point, so
         a failure here must not be reported as "could not save the trip". It used
         to share the outer catch and did exactly that — the trip was on file and
         the screen said it was not.

         Keep the vehicle book in step with whatever was entered here, without
         letting a blank field erase what is already on file. The old version
         compared `existing.driverName !== formData.driverName` and wrote the
         form's values straight over the record: with the driver fields now
         optional, that compares undefined against '' — true every time — and
         then merged an empty name over a real one. Only values that are present
         and actually different are written.

         `isOwn` is deliberately absent from the payload: the merge would
         otherwise reset a vehicle's ownership every time a trip was logged for
         it, and the trip form is not where that gets decided. */
      let bookNote = null;
      try {
        const driverName = titleCase(formData.driverName);
        const mobileNumber = formData.mobileNumber.trim();
        const existing = vehicles.find((item) => sameText(item.vehicleNumber, number));

        const changes = {};
        if (driverName && !sameText(existing?.driverName, driverName))
          changes.driverName = driverName;
        if (mobileNumber && String(existing?.mobileNumber || '') !== mobileNumber)
          changes.mobileNumber = mobileNumber;

        if (!existing || Object.keys(changes).length) {
          await vehicleService.addVehicle({
            vehicleNumber: number,
            // Always sent, because addVehicle defaults a missing type to 'lorry'
            // and would reclassify the vehicle on merge. It is prefilled from the
            // vehicle when one is picked, so this is its own value round-tripping.
            vehicleType: formData.vehicleType,
            ...changes,
            isActive: true
          });
        }
      } catch (bookError) {
        console.error('Trip saved, but the vehicle list could not be updated:', bookError);
        bookNote = 'The vehicle list could not be updated.';
      }

      if (bookNote) toast(`Trip saved. ${bookNote}`);
      else toast.success(`Trip saved in ${Math.round(performance.now() - startedAt)} ms`);
      navigate('/');
    } catch (error) {
      console.error('Error adding trip entry:', error);
      toast.error('Could not save the trip');
    } finally {
      setSaving(false);
    }
  };

  // A new-record form always has something to commit, so the nav bar owns
  // Cancel / Save for the whole life of the screen — Calendar's New Event.
  useCommitAction({
    token: 'add-trip',
    commitLabel: 'Save',
    busy: saving,
    onCommit: handleSubmit,
    onCancel: () => navigate(-1)
  });

  return (
    <form className="entry" onSubmit={handleSubmit} noValidate>
      {/* Keeps keyboard submission working now that the visible button lives in
          the nav bar. Hidden, so it is neither focusable nor announced. */}
      <button type="submit" hidden>
        Save Trip
      </button>

      {/* Identity header: what this record is, before any data entry. */}
      <Card className="entry__hero">
        <span className="entry__hero-icon">
          <TruckIcon size={26} />
        </span>
        <div className="entry__hero-text">
          <span className="entry__hero-title">Trip #{formData.slNumber || '—'}</span>
          <span className="entry__hero-sub">
            {format(new Date(formData.date), 'EEEE, d MMMM yyyy')}
          </span>
        </div>
      </Card>

      {/* The footer carries the hint only. Field errors are rendered by the
          controls themselves, next to the input that is wrong and wired to
          aria-invalid; repeating them here printed every message twice, one line
          apart, and pushed the hint out of view exactly when it was needed. */}
      <ListSection
        header="Vehicle"
        footer="Driver name and mobile are optional. A number that is not on the list is added to your vehicles when the trip is saved."
      >
        <ListRow>
          <Picker
            label="Number"
            layout="row"
            value={formData.vehicleNumber}
            options={vehicleOptions}
            onChange={handleVehiclePick}
            onCreate={handleVehicleCreate}
            /* "Add", not "Use": the row does add the vehicle, and a label that
               describes the consequence is what makes the automatic save
               predictable rather than surprising. */
            createLabel="Add"
            searchable
            searchPlaceholder="Search or type a new number"
            placeholder="Select vehicle"
            error={errors.vehicleNumber}
          />
        </ListRow>

        <ListRow title="Type">
          <Segmented
            className="entry__segmented"
            options={VEHICLE_TYPES}
            value={formData.vehicleType}
            onChange={(value) => setField('vehicleType', value)}
            ariaLabel="Vehicle type"
          />
        </ListRow>

        <ListRow>
          <TextField
            label="Driver"
            layout="row"
            value={formData.driverName}
            onChange={(e) => setField('driverName', e.target.value)}
            placeholder="Optional"
            autoCapitalize="words"
            autoComplete="off"
          />
        </ListRow>

        <ListRow>
          <PhoneField
            label="Mobile"
            layout="row"
            value={formData.mobileNumber}
            onChange={(e) => setField('mobileNumber', e.target.value)}
            placeholder="Optional"
            error={errors.mobileNumber}
          />
        </ListRow>
      </ListSection>

      <ListSection
        header="Route"
        footer={
          errors.villages ||
          'Type a village that is not listed and it is added to your villages, with a code suggested from the name.'
        }
      >
        {/* The chips *are* the value, so they come first and the picker below
            them is the action that adds more — the shape Calendar uses for
            guests. There used to be a third row above these reading
            "Villages — 2 added": a count sitting directly on top of the list it
            was counting, which is the same quantity stated twice. */}
        {formData.villages.length > 0 && (
          <ListRow className="entry__chips-row">
            <div className="entry__chips">
              {formData.villages.map((village) => (
                <Chip key={village} onRemove={() => removeVillage(village)}>
                  {village}
                </Chip>
              ))}
            </div>
          </ListRow>
        )}

        <ListRow className="entry__add-row">
          <Picker
            label="Add villages"
            layout="row"
            multiple
            value={formData.villages}
            options={villageOptions}
            onChange={handleVillagesChange}
            onCreate={handleVillageCreate}
            createLabel="Add"
            searchable
            searchPlaceholder="Search or type a new village"
            placeholder="Choose"
            /* The chips above are the value, so this row is the action. Without
               the override the trigger would read "2 selected" directly beneath
               the two chips it is counting. */
            summary={formData.villages.length ? 'Add more' : 'Choose'}
          />
        </ListRow>

        <ListRow>
          <NumberField
            label="Quantity"
            layout="row"
            decimal
            value={formData.quantity}
            onChange={(e) => setField('quantity', e.target.value)}
            placeholder="Optional"
          />
        </ListRow>
      </ListSection>

      <ListSection
        header="Advance & STR"
        footer={
          parseFloat(formData.advanceAmount) > 0
            ? 'Recorded as this trip’s opening advance, so it appears in the ledger and in Reports without a second entry.'
            : 'Leave the advance empty if nothing has been paid yet. Top-ups are added later from Add Advance.'
        }
      >
        <ListRow>
          <CurrencyField
            label="Advance"
            layout="row"
            value={formData.advanceAmount}
            onChange={(e) => setField('advanceAmount', e.target.value)}
            placeholder="0"
            error={errors.advanceAmount}
          />
        </ListRow>

        <ListRow title="STR status">
          <Segmented
            className="entry__segmented"
            options={STR_OPTIONS}
            value={formData.strNumber}
            onChange={(value) => setField('strNumber', value)}
            ariaLabel="STR status"
          />
        </ListRow>
      </ListSection>

      <ListSection
        header="Record"
        footer="Leave the SL number as generated unless you are backfilling an older trip."
      >
        <ListRow>
          <NumberField
            label="SL number"
            layout="row"
            value={formData.slNumber}
            onChange={(e) => setField('slNumber', e.target.value)}
            placeholder="Auto"
          />
        </ListRow>
        <ListRow>
          <DateField
            label="Date"
            layout="row"
            value={formData.date}
            onChange={(e) => setField('date', e.target.value)}
          />
        </ListRow>
      </ListSection>

      {/* No pinned action bar. Save and Cancel live in the nav bar for as long
          as this screen is open — see components/Layout/useCommitAction.js. */}
    </form>
  );
};

export default AddEntryForm;
