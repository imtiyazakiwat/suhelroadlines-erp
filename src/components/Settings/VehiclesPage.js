import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { vehicleService } from '../../services/firebaseService';
import {
  Button,
  ImagePicker,
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
  ActionSheet,
  Alert,
  useToast
} from '../../ui';
import {
  normaliseVehicleNumber,
  formatVehicleNumber,
  titleCase,
  mobileError,
  sameText
} from '../../services/textService';
import { TruckIcon, PlusIcon } from '../Common/Icons';
import './SettingsPage.css';

/* =============================================================================
   Vehicles — pushed from /settings.

   One modal layer: tapping a row opens the editor sheet directly, with no
   manager sheet underneath it. The add action is a row closing the list, the way
   Settings offers Add Account, rather than a floating button or a nav bar plus.

   Own vs hired
   ------------
   The list is split into "My vehicles" and "Other vehicles" instead of gaining a
   second filter control. Recognition over recall: both groups stay on screen, so
   the answer to "how many of these are mine" is visible without a decision, and
   the split costs no extra tap. A segmented control would have hidden one group
   behind the other and would have had to fight the status filter above it for
   meaning.

   Removing a vehicle
   ------------------
   Two different intentions were sharing one button. "Remove vehicle" set
   isActive: false and called it a delete, so a vehicle the user had asked to get
   rid of kept turning up in this list forever. They are now separate, offered
   together from one row, reversible option first:

     Deactivate         keeps the record and its history, stops it being offered
                        on the trip form. Undo is the same menu.
     Delete permanently second confirmation, and it really deletes.
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
  // Defaults to false, not true: a new vehicle has not been asked yet, and
  // pre-ticking "mine" would put hired lorries in the wrong group by default.
  isOwn: false,
  isActive: true,
  imageUrl: ''
};

/** Missing field means "never marked", which is not the same as "mine". */
const isOwnVehicle = (vehicle) => vehicle?.isOwn === true;

const VehiclesPage = () => {
  const toast = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');

  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Three separate pieces of state because they are three separate steps:
  // the menu of removal options, and the final confirmation for the one that
  // cannot be undone.
  const [removing, setRemoving] = useState(null);
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

  /* Own vehicles first, because they are the ones being dispatched daily and the
     ones this list is opened to check. A group with nothing in it is dropped
     rather than shown empty — an "Other vehicles" header over blank space would
     imply records that are not there. */
  const groups = useMemo(
    () =>
      [
        { key: 'own', header: 'My vehicles', items: visible.filter(isOwnVehicle) },
        {
          key: 'other',
          header: 'Other vehicles',
          items: visible.filter((item) => !isOwnVehicle(item))
        }
      ].filter((group) => group.items.length > 0),
    [visible]
  );

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
      isOwn: isOwnVehicle(vehicle),
      isActive: vehicle.isActive !== false,
      imageUrl: vehicle.imageUrl || ''
    });
  };

  // Errors clear as the field is corrected, rather than sitting there stale
  // until the next save attempt.
  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  const save = async () => {
    // Settled form: uppercase and trimmed. The number is the document id, so a
    // stray trailing space would create a second vehicle that could never be
    // reconciled with the first.
    const number = formatVehicleNumber(draft.vehicleNumber);
    const next = {};

    if (!number) next.vehicleNumber = 'Vehicle number is required';
    else if (!draft.existing && vehicles.some((item) => sameText(item.vehicleNumber, number))) {
      // The service writes with merge on a doc keyed by the number, so without
      // this a duplicate silently overwrote the existing vehicle.
      next.vehicleNumber = 'That vehicle number is already on record';
    }

    // Driver name and mobile number are both optional. A vehicle is often on the
    // books before anyone knows who is driving it, and refusing to record the
    // vehicle over a missing name meant the number never got entered at all.
    // A mobile number that *is* given still has to be a real one.
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
        isOwn: draft.isOwn === true,
        isActive: draft.isActive,
        imageUrl: draft.imageUrl || ''
      };

      if (draft.existing) {
        await vehicleService.updateVehicle(draft.existing, payload);
        toast.success(`${formatVehicleNumber(draft.existing)} updated`);
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

  /** Reversible, so it applies straight away and says how to undo it. */
  const setActive = async (vehicle, active) => {
    try {
      await vehicleService.deactivateVehicle(vehicle.vehicleNumber, active);
      toast.success(
        active
          ? `${formatVehicleNumber(vehicle.vehicleNumber)} is active again`
          : `${formatVehicleNumber(vehicle.vehicleNumber)} deactivated`
      );
      setDraft(null);
      await load();
    } catch (error) {
      console.error('Error changing vehicle status:', error);
      toast.error(error?.message || 'Could not change the vehicle');
    }
  };

  const confirmDelete = async () => {
    const vehicle = pendingDelete;
    if (!vehicle) return;

    try {
      await vehicleService.deleteVehicle(vehicle.vehicleNumber);
      toast.success(`${formatVehicleNumber(vehicle.vehicleNumber)} deleted`);
      setDraft(null);
      await load();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast.error(error?.message || 'Could not delete the vehicle');
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
        groups.map((group, index) => (
          <ListSection
            inset={false}
            className="stg26"
            header={group.header}
            /* The footer sits under the last group only, so the explanation of
               the split is the final word rather than an interruption. */
            footer={
              index === groups.length - 1
                ? 'Open a vehicle and turn on “My vehicle” to list it under My vehicles.'
                : undefined
            }
            key={`${filter}-${group.key}`}
          >
            {group.items.map((vehicle) => (
              <ListRow
                key={vehicle.vehicleNumber}
                thumbnail={vehicle.imageUrl || undefined}
                icon={<TruckIcon size={17} />}
                iconTone={vehicle.isActive === false ? 'neutral' : 'brand'}
                /* Uppercased on the way out as well as on the way in: records
                   written before normalisation existed can still be mixed case,
                   and a number plate is uppercase on every permit and STR. */
                title={formatVehicleNumber(vehicle.vehicleNumber)}
                subtitle={
                  [vehicle.driverName, vehicle.mobileNumber].filter(Boolean).join(' · ') ||
                  'No driver on file'
                }
                badge={
                  vehicle.isActive === false ? <Badge tone="neutral">Inactive</Badge> : null
                }
                chevron
                onClick={() => openEdit(vehicle)}
              />
            ))}
          </ListSection>
        ))
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
            {/* Identity: which vehicle this is, and whose. Both answer the same
                question, so they share a section rather than adding a fourth. */}
            <ListSection
              inset={false}
              footer={
                errors.vehicleNumber ||
                'Turn on My vehicle for lorries you own, so they list apart from hired ones.'
              }
            >
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
              <ListRow
                title="My vehicle"
                accessory={
                  <Switch
                    checked={draft.isOwn}
                    onChange={(value) => setField('isOwn', value)}
                    label="My vehicle"
                  />
                }
              />
            </ListSection>

            <ListSection
              inset={false}
              header="Driver"
              footer={errors.mobileNumber || 'Both are optional. Add them when you know them.'}
            >
              <ListRow>
                <TextField
                  label="Name"
                  layout="row"
                  value={draft.driverName}
                  onChange={(event) => setField('driverName', event.target.value)}
                  placeholder="Optional"
                  autoCapitalize="words"
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
              header="Photo"
              footer="Optional — a photo of the lorry, registration book, or anything relevant."
            >
              <ListRow>
                <ImagePicker
                  value={draft.imageUrl}
                  onChange={(url) => setField('imageUrl', url)}
                  disabled={saving}
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
                {/* One row, two intentions behind it. The choice between keeping
                    the record and destroying it belongs in the menu, where both
                    can be described, not split across two rows a thumb can
                    confuse. */}
                <ListRow
                  title="Remove vehicle…"
                  destructive
                  onClick={() =>
                    setRemoving({
                      vehicleNumber: draft.existing,
                      isActive: draft.isActive
                    })
                  }
                />
              </ListSection>
            )}
          </>
        )}
      </Sheet>

      <ActionSheet
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? formatVehicleNumber(removing.vehicleNumber) : ''}
        message="Deactivating keeps the record and its trips, and can be undone. Deleting cannot."
        actions={
          removing
            ? [
                removing.isActive
                  ? { label: 'Deactivate', onSelect: () => setActive(removing, false) }
                  : { label: 'Reactivate', onSelect: () => setActive(removing, true) },
                {
                  label: 'Delete Permanently',
                  destructive: true,
                  onSelect: () => setPendingDelete(removing)
                }
              ]
            : []
        }
      />

      <Alert
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this vehicle?"
        message={`${formatVehicleNumber(
          pendingDelete?.vehicleNumber
        )} will be removed from the vehicle list. Trips and advances already recorded against it are kept. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default VehiclesPage;
