import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, advanceService } from '../../services/firebaseService';
import { createAdvance, calculateAdvanceTotals } from '../../types';
import { formatINR } from '../../services/homeService';
import { format } from 'date-fns';
import {
  Button,
  Card,
  ImagePicker,
  ListSection,
  ListRow,
  Picker,
  Badge,
  DateField,
  TextArea,
  EmptyState,
  Skeleton,
  useToast
} from '../../ui';
import useCommitAction from '../Layout/useCommitAction';
import { formatVehicleNumber } from '../../services/textService';
import { WalletIcon, TruckIcon, RupeeIcon } from '../Common/Icons';
import './AddAdvance.css';

/* Modelled on Apple Cash: the amount is the hero, the source and destination
   are two rows beneath it, and everything else is secondary. The commit action
   sits in the nav bar, so the amount stays the only emphasis on the page. */

const formatDate = (value) => {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  return isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy');
};

const AddAdvance = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    vehicleNumber: '',
    selectedTripId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
    images: []
  });

  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [advancesByTrip, setAdvancesByTrip] = useState({});
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    vehicleService
      .getAllVehicles()
      .then((list) => setVehicles(list || []))
      .catch((error) => console.error('Error loading vehicles:', error));
  }, []);

  /**
   * One pass over all advances instead of a per-trip request. The old version
   * awaited getAdvancesByTrip inside a serial for-loop, so picking a vehicle
   * with 20 trips fired 20 sequential reads.
   */
  const loadTripsForVehicle = useCallback(async (vehicleNumber) => {
    if (!vehicleNumber) return;

    try {
      setLoadingTrips(true);

      const [tripList, allAdvances] = await Promise.all([
        tripService.getTripsByVehicle(vehicleNumber),
        advanceService.getAllAdvances()
      ]);

      const grouped = new Map();
      (allAdvances || []).forEach((advance) => {
        if (!advance.tripId) return;
        if (!grouped.has(advance.tripId)) grouped.set(advance.tripId, []);
        grouped.get(advance.tripId).push(advance);
      });

      const summaries = {};
      (tripList || []).forEach((trip) => {
        summaries[trip.id] = calculateAdvanceTotals(grouped.get(trip.id) || []);
      });

      setTrips(tripList || []);
      setAdvancesByTrip(summaries);
    } catch (error) {
      console.error('Error loading trips:', error);
      toast.error('Could not load trips for this vehicle');
    } finally {
      setLoadingTrips(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTripsForVehicle(formData.vehicleNumber);
  }, [formData.vehicleNumber, loadTripsForVehicle]);

  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  /* Own lorries first and marked as such, same as the trip form. Numbers are
     uppercased on the way out because older records can still be mixed case. */
  const vehicleOptions = useMemo(() => {
    const toOption = (vehicle) => ({
      value: vehicle.vehicleNumber,
      label: formatVehicleNumber(vehicle.vehicleNumber),
      subtitle:
        [vehicle.isOwn === true ? 'My vehicle' : null, vehicle.driverName, vehicle.mobileNumber]
          .filter(Boolean)
          .join(' · ') || undefined
    });

    return [
      ...vehicles.filter((vehicle) => vehicle.isOwn === true).map(toOption),
      ...vehicles.filter((vehicle) => vehicle.isOwn !== true).map(toOption)
    ];
  }, [vehicles]);

  const tripOptions = useMemo(
    () =>
      trips.map((trip) => {
        const totals = advancesByTrip[trip.id];
        return {
          value: trip.id,
          label: `#${trip.slNumber ?? '—'} · ${formatDate(trip.date)}`,
          subtitle: totals?.total
            ? `${formatINR(totals.total)} advanced · ${totals.count} entr${totals.count === 1 ? 'y' : 'ies'}`
            : 'No advance yet'
        };
      }),
    [trips, advancesByTrip]
  );

  const selectedTrip = trips.find((trip) => trip.id === formData.selectedTripId) || null;
  const selectedTotals = selectedTrip ? advancesByTrip[selectedTrip.id] : null;
  const amountValue = parseFloat(formData.amount) || 0;

  const validate = () => {
    const next = {};
    if (!formData.vehicleNumber.trim()) next.vehicleNumber = 'Choose a vehicle';
    if (!formData.selectedTripId) next.selectedTripId = 'Choose a trip';
    if (!formData.amount || amountValue <= 0) next.amount = 'Enter an amount greater than zero';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Reachable from the nav bar Add button and from keyboard submission; only
  // the latter carries an event.
  const handleSubmit = async (event) => {
    if (event) event.preventDefault();

    if (!validate()) {
      toast.error('Check the highlighted fields');
      return;
    }

    setSaving(true);
    const startedAt = performance.now();

    try {
      const advanceData = createAdvance({
        vehicleNumber: formData.vehicleNumber,
        tripId: selectedTrip.id,
        tripDate: selectedTrip.date,
        advanceAmount: amountValue,
        note: formData.note.trim(),
        advanceType: 'additional',
        images: formData.images
      });

      await advanceService.addAdvance(advanceData);

      toast.success(
        `${formatINR(amountValue)} added in ${Math.round(performance.now() - startedAt)} ms`
      );
      navigate('/');
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error('Could not add the advance');
    } finally {
      setSaving(false);
    }
  };

  /* The amount is already the hero of this screen, so the nav bar button stays
     the short verb rather than repeating the figure. It stays disabled until
     there is a trip and a positive amount. */
  useCommitAction({
    token: 'add-advance',
    commitLabel: 'Add',
    busy: saving,
    disabled: !selectedTrip || amountValue <= 0,
    onCommit: handleSubmit,
    onCancel: () => navigate(-1)
  });

  return (
    <form className="adv" onSubmit={handleSubmit} noValidate>
      {/* Keeps keyboard submission working now that the visible action is in the
          nav bar. */}
      <button type="submit" hidden>
        Add Advance
      </button>

      {/* Hero: the amount, stated once and large. */}
      <Card className="adv__hero">
        <span className="adv__hero-label">Advance amount</span>
        <div className="adv__hero-amount">
          <span className="adv__hero-currency">₹</span>
          <input
            className="adv__hero-input"
            type="text"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) =>
              setField('amount', e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))
            }
            placeholder="0"
            aria-label="Advance amount"
            autoComplete="off"
          />
        </div>
        {errors.amount && <span className="adv__hero-error">{errors.amount}</span>}

        {selectedTotals?.total > 0 && (
          <div className="adv__hero-context">
            <Badge tone="neutral">{formatINR(selectedTotals.total)} already advanced</Badge>
            {amountValue > 0 && (
              <Badge tone="accent">New total {formatINR(selectedTotals.total + amountValue)}</Badge>
            )}
          </div>
        )}
      </Card>

      <ListSection header="Apply to" footer={errors.vehicleNumber || errors.selectedTripId}>
        <ListRow icon={<TruckIcon size={17} />} iconTone="brand">
          <Picker
            label="Vehicle"
            layout="row"
            value={formData.vehicleNumber}
            options={vehicleOptions}
            onChange={(value) => {
              // Changing vehicle invalidates the chosen trip.
              setFormData((prev) => ({ ...prev, vehicleNumber: value, selectedTripId: '' }));
              setErrors((prev) => ({ ...prev, vehicleNumber: null, selectedTripId: null }));
            }}
            searchable
            searchPlaceholder="Search vehicle or driver"
            placeholder="Select"
            error={errors.vehicleNumber}
          />
        </ListRow>

        <ListRow icon={<WalletIcon size={17} />} iconTone="accent">
          <Picker
            label="Trip"
            layout="row"
            value={formData.selectedTripId}
            options={tripOptions}
            onChange={(value) => setField('selectedTripId', value)}
            searchable={tripOptions.length > 7}
            searchPlaceholder="Search trips"
            placeholder={
              !formData.vehicleNumber
                ? 'Pick a vehicle first'
                : loadingTrips
                ? 'Loading…'
                : tripOptions.length
                ? 'Select'
                : 'No trips'
            }
            disabled={!formData.vehicleNumber || loadingTrips || tripOptions.length === 0}
            error={errors.selectedTripId}
          />
        </ListRow>
      </ListSection>

      {/* Context on the chosen trip, so the user can confirm before saving. */}
      {loadingTrips && formData.vehicleNumber && (
        <div className="adv__skeleton">
          <Skeleton height={72} radius="var(--r-lg)" />
        </div>
      )}

      {!loadingTrips && selectedTrip && (
        <ListSection header="Trip detail">
          <ListRow title="Driver" value={selectedTrip.driverName || '—'} />
          <ListRow title="Date" value={formatDate(selectedTrip.date)} />
          <ListRow
            title="Route"
            value={(selectedTrip.villages || []).join(', ') || '—'}
          />
          <ListRow
            title="Advanced so far"
            value={formatINR(selectedTotals?.total || 0)}
            valueTone={selectedTotals?.total ? 'strong' : 'neutral'}
          />
        </ListSection>
      )}

      {!loadingTrips && formData.vehicleNumber && tripOptions.length === 0 && (
        <Card padded={false} className="adv__empty">
          <EmptyState
            icon={<RupeeIcon size={26} />}
            title="No trips for this vehicle"
            message="Create a trip before recording an advance against it."
            action={
              <Button variant="tinted" onClick={() => navigate('/add-entry')}>
                Add a trip
              </Button>
            }
          />
        </Card>
      )}

      <ListSection header="Details" footer="The note appears alongside the advance in reports.">
        <ListRow>
          <DateField
            label="Date"
            layout="row"
            value={formData.date}
            onChange={(e) => setField('date', e.target.value)}
          />
        </ListRow>
        <ListRow className="adv__note-row">
          <TextArea
            label="Note"
            value={formData.note}
            onChange={(e) => setField('note', e.target.value)}
            placeholder="Cash at pump, driver request…"
            rows={3}
          />
        </ListRow>
        <ListRow>
          <ImagePicker
            value={formData.images}
            onChange={(images) => setField('images', images)}
            disabled={saving}
          />
        </ListRow>
      </ListSection>

      {/* No pinned action bar. Add and Cancel live in the nav bar. */}
    </form>
  );
};

export default AddAdvance;
