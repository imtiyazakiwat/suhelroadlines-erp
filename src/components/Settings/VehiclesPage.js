import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { vehicleService } from '../../services/firebaseService';
import {
  Button,
  Segmented,
  SearchField,
  TextField,
  PhoneField,
  Picker,
  ListSection,
  ListRow,
  Badge,
  Switch,
  EmptyState,
  Skeleton,
  Sheet,
  Alert,
  useToast
} from '../../ui';
import {
  normaliseVehicleNumber,
  titleCase,
  mobileError,
  sameText,
  tidy
} from '../../services/textService';
import { TruckIcon, PlusIcon } from '../Common/Icons';
import './SettingsPage.css';

/* =============================================================================
   Vehicles — pushed from /settings.

   One modal layer: tapping a row opens the editor sheet directly, with no
   manager sheet underneath it. The add action is a row closing the list, the way
   Settings offers Add Account, rather than a floating button or a nav bar plus.
   ========================================================================== */

const VEHICLE_TYPES = [
  { value: 'lorry', label: 'Lorry' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'pickup', label: 'Pickup' }
];

const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' }
];

const EMPTY = {
  vehicleNumber: '',
  driverName: '',
  mobileNumber: '',
  vehicleType: 'lorry',
  isActive: true
};

const VehiclesPage = () => {
  const toast = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');

  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setVehicles((await vehicleService.getAllVehicles(true)) || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast.error('Could not load vehicles');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      active: vehicles.filter((item) => item.isActive !== false).length,
      inactive: vehicles.filter((item) => item.isActive === false).length,
      all: vehicles.length
    }),
    [vehicles]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return vehicles
      .filter((item) => {
        if (filter === 'active' && item.isActive === false) return false;
        if (filter === 'inactive' && item.isActive !== false) return false;
        if (!term) return true;
        return `${item.vehicleNumber} ${item.driverName || ''} ${item.mobileNumber || ''}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => String(a.vehicleNumber).localeCompare(String(b.vehicleNumber)));
  }, [vehicles, query, filter]);

  const openNew = () => {
    setErrors({});
    setDraft({ ...EMPTY });
  };

  const openEdit = (vehicle) => {
    setErrors({});
    setDraft({
      existing: vehicle.vehicleNumber,
      vehicleNumber: vehicle.vehicleNumber,
      driverName: vehicle.driverName || '',
      mobileNumber: vehicle.mobileNumber || '',
      vehicleType: vehicle.vehicleType || 'lorry',
      isActive: vehicle.isActive !== false
    });
  };

  // Errors clear as the field is corrected, rather than sitting there stale
  // until the next save attempt.
  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  const save = async () => {
    const number = normaliseVehicleNumber(draft.vehicleNumber);
    const next = {};

    if (!number.trim()) next.vehicleNumber = 'Vehicle number is required';
    else if (
      !draft.existing &&
      vehicles.some((item) => sameText(item.vehicleNumber, number))
    ) {
      // The service writes with merge on a doc keyed by the number, so without
      // this a duplicate silently overwrote the existing vehicle.
      next.vehicleNumber = 'That vehicle number is already on record';
    }

    if (!tidy(draft.driverName)) next.driverName = 'Driver name is required';

    const mobileProblem = mobileError(draft.mobileNumber);
    if (mobileProblem) next.mobileNumber = mobileProblem;

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const payload = {
        driverName: titleCase(draft.driverName),
        mobileNumber: String(draft.mobileNumber || '').trim(),
        vehicleType: draft.vehicleType,
        isActive: draft.isActive
      };

      if (draft.existing) {
        await vehicleService.updateVehicle(draft.existing, payload);
        toast.success(`${draft.existing} updated`);
      } else {
        await vehicleService.addVehicle({ ...payload, vehicleNumber: number });
        toast.success(`${number} added`);
      }

      setDraft(null);
      await load();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      toast.error(error?.message || 'Could not save the vehicle');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const vehicle = pendingDelete;
    if (!vehicle) return;

    try {
      await vehicleService.deleteVehicle(vehicle.vehicleNumber);
      toast.success(`${vehicle.vehicleNumber} removed`);
      await load();
    } catch (error) {
      console.error('Error removing vehicle:', error);
      toast.error(error?.message || 'Could not remove the vehicle');
    } finally {
      setPendingDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="fleet">
        <div className="set__skeleton">
          <Skeleton height={40} radius="var(--r-capsule)" />
          <Skeleton height={200} radius="var(--r-lg)" />
        </div>
      </div>
    );
  }

  return (
    <div className="fleet">
      <div className="fleet__toolbar">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Number, driver or mobile"
        />
        <Segmented
          options={FILTERS.map((item) => ({ ...item, count: counts[item.value] }))}
          value={filter}
          onChange={setFilter}
          ariaLabel="Vehicle status"
        />
      </div>

      {visible.length === 0 ? (
        <ListSection inset={false}>
          <EmptyState
            icon={<TruckIcon size={26} />}
            title={query ? 'No matches' : 'No vehicles here'}
            message={
              query
                ? `Nothing matched “${query.trim()}”.`
                : filter === 'inactive'
                ? 'Nothing has been deactivated.'
                : 'Add your first vehicle to get started.'
            }
            action={
              query ? (
                <Button variant="tinted" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="tinted" onClick={openNew}>
                  Add Vehicle
                </Button>
              )
            }
          />
        </ListSection>
      ) : (
        <ListSection
          inset={false}
          className="stg26"
          header={`${visible.length} ${visible.length === 1 ? 'vehicle' : 'vehicles'}`}
          key={filter}
        >
          {visible.map((vehicle) => (
            <ListRow
              key={vehicle.vehicleNumber}
              icon={<TruckIcon size={17} />}
              iconTone={vehicle.isActive === false ? 'neutral' : 'brand'}
              title={vehicle.vehicleNumber}
              subtitle={
                [vehicle.driverName, vehicle.mobileNumber].filter(Boolean).join(' · ') ||
                'No driver on file'
              }
              badge={vehicle.isActive === false ? <Badge tone="neutral">Inactive</Badge> : null}
              chevron
              onClick={() => openEdit(vehicle)}
            />
          ))}
        </ListSection>
      )}

      <ListSection inset={false}>
        <ListRow
          className="set__add-row"
          icon={<PlusIcon size={17} />}
          iconTone="accent"
          title="Add Vehicle"
          onClick={openNew}
        />
      </ListSection>

      <Sheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.existing ? 'Edit vehicle' : 'New vehicle'}
        detent="large"
        secondaryAction={
          <Button variant="plain" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        }
        primaryAction={
          <Button variant="plain" loading={saving} onClick={save}>
            Save
          </Button>
        }
      >
        {draft && (
          <>
            <ListSection inset={false} footer={errors.vehicleNumber}>
              <ListRow>
                <TextField
                  label="Number"
                  layout="row"
                  value={draft.vehicleNumber}
                  // Uppercased as you type. Vehicle numbers are uppercase on
                  // every permit and STR, so correcting at save time would show
                  // the user one thing and store another.
                  onChange={(event) =>
                    setField('vehicleNumber', normaliseVehicleNumber(event.target.value))
                  }
                  placeholder="KA 01 AB 1234"
                  disabled={Boolean(draft.existing)}
                  autoCapitalize="characters"
                  error={errors.vehicleNumber}
                  data-autofocus={draft.existing ? undefined : true}
                />
              </ListRow>
            </ListSection>

            <ListSection
              inset={false}
              header="Driver"
              footer={errors.driverName || errors.mobileNumber || 'Mobile number is optional.'}
            >
              <ListRow>
                <TextField
                  label="Name"
                  layout="row"
                  value={draft.driverName}
                  onChange={(event) => setField('driverName', event.target.value)}
                  placeholder="Full name"
                  autoCapitalize="words"
                  error={errors.driverName}
                />
              </ListRow>
              <ListRow>
                <PhoneField
                  label="Mobile"
                  layout="row"
                  value={draft.mobileNumber}
                  onChange={(event) => setField('mobileNumber', event.target.value)}
                  placeholder="Optional"
                  error={errors.mobileNumber}
                />
              </ListRow>
            </ListSection>

            <ListSection
              inset={false}
              header="Availability"
              footer="An inactive vehicle stays on record and keeps its trip history, but stops appearing in the trip form."
            >
              <ListRow>
                <Picker
                  label="Type"
                  layout="row"
                  value={draft.vehicleType}
                  options={VEHICLE_TYPES}
                  onChange={(value) => setField('vehicleType', value)}
                />
              </ListRow>
              <ListRow
                title="Active"
                accessory={
                  <Switch
                    checked={draft.isActive}
                    onChange={(value) => setField('isActive', value)}
                    label="Vehicle active"
                  />
                }
              />
            </ListSection>

            {draft.existing && (
              <ListSection inset={false}>
                <ListRow
                  title="Remove vehicle"
                  destructive
                  onClick={() => setPendingDelete({ vehicleNumber: draft.existing })}
                />
              </ListSection>
            )}
          </>
        )}
      </Sheet>

      <Alert
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove this vehicle?"
        message={`${pendingDelete?.vehicleNumber} will stop appearing in the trip form. Existing trips keep their history.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default VehiclesPage;
