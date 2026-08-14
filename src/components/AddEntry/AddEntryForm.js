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

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        value: vehicle.vehicleNumber,
        label: vehicle.vehicleNumber,
        subtitle: [vehicle.driverName, vehicle.mobileNumber].filter(Boolean).join(' · ')
      })),
    [vehicles]
  );

  const villageOptions = useMemo(
    () =>
      allVillages.map((village) => ({
        value: village.villageName,
        label: village.villageName,
        subtitle: `Used ${village.usageCount || 0} times`
      })),
    [allVillages]
  );

  /** Picking a known vehicle carries its driver and mobile across. */
  const handleVehiclePick = (vehicleNumber) => {
    const vehicle = vehicles.find((item) => item.vehicleNumber === vehicleNumber);
    setFormData((prev) => ({
      ...prev,
      vehicleNumber,
      driverName: vehicle?.driverName || prev.driverName,
      mobileNumber: vehicle?.mobileNumber || prev.mobileNumber
    }));
    setErrors((prev) => ({ ...prev, vehicleNumber: null }));
  };

  const handleVehicleCreate = (vehicleNumber) => {
    setField('vehicleNumber', vehicleNumber.toUpperCase());
  };

  const handleVillagesChange = (next, option) => {
    setField('villages', next);
    // Usage count drives the ordering of the village list; fire and forget.
    if (option && next.includes(option.value)) {
      const village = allVillages.find((item) => item.villageName === option.value);
      if (village?.id) villageService.updateVillageUsage(village.id).catch(() => {});
    }
  };

  const handleVillageCreate = async (villageName) => {
    if (formData.villages.includes(villageName)) return;

    // Optimistic: the chip appears immediately, Firestore catches up.
    setField('villages', [...formData.villages, villageName]);

    try {
      const created = await villageService.addVillage({
        villageName,
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

    if (!formData.vehicleNumber.trim()) next.vehicleNumber = 'Vehicle number is required';
    if (!formData.strNumber?.trim()) next.strNumber = 'STR status is required';
    if (!formData.vehicleType) next.vehicleType = 'Vehicle type is required';
    if (formData.villages.length === 0) next.villages = 'Add at least one village';
    if (!formData.driverName.trim()) next.driverName = 'Driver name is required';

    if (!formData.mobileNumber.trim()) next.mobileNumber = 'Mobile number is required';
    else if (!/^[6-9]\d{9}$/.test(formData.mobileNumber))
      next.mobileNumber = 'Enter a valid 10-digit mobile number';

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
      const tripData = createTripEntry({
        slNumber: parseInt(formData.slNumber, 10),
        date: new Date(formData.date),
        vehicleNumber: formData.vehicleNumber.trim(),
        strNumber: formData.strNumber.trim(),
        vehicleType: formData.vehicleType,
        villages: formData.villages,
        quantity: parseFloat(formData.quantity),
        driverName: formData.driverName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        advanceAmount: parseFloat(formData.advanceAmount) || 0
      });

      await tripService.addTrip(tripData);

      // Keep the vehicle book in step with whatever was entered here.
      const existing = vehicles.find((item) => item.vehicleNumber === formData.vehicleNumber);
      if (
        !existing ||
        existing.driverName !== formData.driverName ||
        existing.mobileNumber !== formData.mobileNumber
      ) {
        await vehicleService.addVehicle({
          vehicleNumber: formData.vehicleNumber.trim(),
          driverName: formData.driverName.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          vehicleType: formData.vehicleType,
          isActive: true
        });
      }

      toast.success(`Trip saved in ${Math.round(performance.now() - startedAt)} ms`);
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

      <ListSection header="Vehicle" footer={errors.vehicleNumber || errors.driverName || errors.mobileNumber}>
        <ListRow>
          <Picker
            label="Number"
            layout="row"
            value={formData.vehicleNumber}
            options={vehicleOptions}
            onChange={handleVehiclePick}
            onCreate={handleVehicleCreate}
            createLabel="Use"
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
            placeholder="Full name"
            autoCapitalize="words"
            autoComplete="off"
            error={errors.driverName}
          />
        </ListRow>

        <ListRow>
          <PhoneField
            label="Mobile"
            layout="row"
            value={formData.mobileNumber}
            onChange={(e) => setField('mobileNumber', e.target.value)}
            placeholder="10 digits"
            error={errors.mobileNumber}
          />
        </ListRow>
      </ListSection>

      <ListSection header="Route" footer={errors.villages}>
        <ListRow
          title="Villages"
          value={formData.villages.length ? `${formData.villages.length} added` : undefined}
        />

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
            createLabel="Create"
            searchable
            searchPlaceholder="Search villages"
            placeholder="Choose"
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

      <ListSection header="Advance & STR" footer={errors.advanceAmount}>
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
