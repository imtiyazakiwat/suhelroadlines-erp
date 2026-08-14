import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { vehicleService, villageService } from '../../services/firebaseService';
import {
  Button,
  Card,
  ListSection,
  ListRow,
  Badge,
  Switch,
  SearchField,
  TextField,
  PhoneField,
  Picker,
  Sheet,
  Alert,
  EmptyState,
  Skeleton,
  Stat,
  useToast
} from '../../ui';
import { TruckIcon, PlusIcon, GearIcon } from '../Common/Icons';
import './SettingsPage.css';

/* Modelled on Settings.app: a short stack of grouped sections, each row a
   destination. Editing happens in a sheet, not inline, so the list never
   reflows under the user. */

const VEHICLE_TYPES = [
  { value: 'lorry', label: 'Lorry' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'pickup', label: 'Pickup' }
];

const EMPTY_VEHICLE = {
  vehicleNumber: '',
  driverName: '',
  mobileNumber: '',
  vehicleType: 'lorry',
  isActive: true
};

const SettingsPage = () => {
  const toast = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);

  // which manager sheet is open: 'vehicles' | 'villages' | null
  const [manager, setManager] = useState(null);
  const [query, setQuery] = useState('');

  // edit sheet state
  const [vehicleDraft, setVehicleDraft] = useState(null);
  const [villageDraft, setVillageDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // pending destructive action
  const [confirm, setConfirm] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehicleList, villageList] = await Promise.all([
        vehicleService.getAllVehicles(),
        villageService.getAllVillages()
      ]);
      setVehicles(vehicleList || []);
      setVillages(villageList || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Could not load fleet data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.isActive !== false).length,
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter((vehicle) =>
      `${vehicle.vehicleNumber} ${vehicle.driverName || ''} ${vehicle.mobileNumber || ''}`
        .toLowerCase()
        .includes(term)
    );
  }, [vehicles, query]);

  const filteredVillages = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return villages;
    return villages.filter((village) => village.villageName.toLowerCase().includes(term));
  }, [villages, query]);

  const openManager = (which) => {
    setQuery('');
    setManager(which);
  };

  /* ------------------------------- vehicles ------------------------------- */

  const saveVehicle = async () => {
    const next = {};
    if (!vehicleDraft.vehicleNumber.trim()) next.vehicleNumber = 'Vehicle number is required';
    if (!vehicleDraft.driverName.trim()) next.driverName = 'Driver name is required';
    if (!vehicleDraft.mobileNumber.trim()) next.mobileNumber = 'Mobile number is required';
    else if (!/^[6-9]\d{9}$/.test(vehicleDraft.mobileNumber))
      next.mobileNumber = 'Enter a valid 10-digit mobile number';

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      if (vehicleDraft.id) {
        await vehicleService.updateVehicle(vehicleDraft.vehicleNumber, {
          driverName: vehicleDraft.driverName.trim(),
          mobileNumber: vehicleDraft.mobileNumber.trim(),
          vehicleType: vehicleDraft.vehicleType,
          isActive: vehicleDraft.isActive
        });
        toast.success('Vehicle updated');
      } else {
        await vehicleService.addVehicle({
          ...vehicleDraft,
          vehicleNumber: vehicleDraft.vehicleNumber.trim().toUpperCase(),
          driverName: vehicleDraft.driverName.trim(),
          mobileNumber: vehicleDraft.mobileNumber.trim()
        });
        toast.success('Vehicle added');
      }

      setVehicleDraft(null);
      loadData();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      toast.error('Could not save the vehicle');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- villages ------------------------------- */

  const saveVillage = async () => {
    if (!villageDraft.villageName.trim()) {
      setErrors({ villageName: 'Village name is required' });
      return;
    }

    setSaving(true);
    try {
      if (villageDraft.id) {
        await villageService.updateVillage(villageDraft.id, {
          villageName: villageDraft.villageName.trim()
        });
        toast.success('Village updated');
      } else {
        await villageService.addVillage({
          villageName: villageDraft.villageName.trim(),
          isActive: true,
          usageCount: 0
        });
        toast.success('Village added');
      }

      setVillageDraft(null);
      loadData();
    } catch (error) {
      console.error('Error saving village:', error);
      toast.error('Could not save the village');
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;

    try {
      if (confirm.kind === 'vehicle') {
        await vehicleService.deleteVehicle(confirm.item.vehicleNumber);
        toast.success('Vehicle removed');
      } else {
        await villageService.deleteVillage(confirm.item.id);
        toast.success('Village removed');
      }
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Could not remove it');
    }
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="set">
      <Card className="set__summary">
        <Stat value={vehicles.length} label="Vehicles" />
        <span className="set__summary-divider" aria-hidden="true" />
        <Stat value={activeVehicles} label="Active" tone="success" dot />
        <span className="set__summary-divider" aria-hidden="true" />
        <Stat value={villages.length} label="Villages" />
      </Card>

      {loading ? (
        <div className="set__skeleton">
          <Skeleton height={132} radius="var(--r-lg)" />
          <Skeleton height={88} radius="var(--r-lg)" />
        </div>
      ) : (
        <>
          <ListSection header="Fleet" footer="Vehicles and villages feed the trip form's pickers.">
            <ListRow
              icon={<TruckIcon size={17} />}
              iconTone="brand"
              title="Vehicles"
              subtitle={`${vehicles.length} on record`}
              value={`${activeVehicles} active`}
              chevron
              onClick={() => openManager('vehicles')}
            />
            <ListRow
              icon={<GearIcon size={17} />}
              iconTone="accent"
              title="Villages"
              subtitle={`${villages.length} on record`}
              chevron
              onClick={() => openManager('villages')}
            />
            {/* The "Add …" row that closes a section, the way Settings offers
                Add Account. This used to be a capsule pinned above the tab dock,
                which put a second bar of actions on the bottom edge. */}
            <ListRow
              className="set__add-row"
              icon={<PlusIcon size={17} />}
              iconTone="accent"
              title="Add Vehicle"
              onClick={() => {
                setErrors({});
                setManager('vehicles');
                setVehicleDraft({ ...EMPTY_VEHICLE });
              }}
            />
          </ListSection>

          <ListSection header="About">
            <ListRow title="App" value="Suhel Roadlines" />
            <ListRow title="Data" value="Firestore + Realtime cache" />
          </ListSection>
        </>
      )}

      {/* ------------------------------ managers ------------------------------ */}

      <Sheet
        open={manager === 'vehicles'}
        onClose={() => setManager(null)}
        title="Vehicles"
        subtitle={`${vehicles.length} on record`}
        detent="large"
        primaryAction={
          <Button
            variant="plain"
            onClick={() => {
              setErrors({});
              setVehicleDraft({ ...EMPTY_VEHICLE });
            }}
          >
            Add
          </Button>
        }
      >
        <div className="set__search">
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vehicle, driver, mobile"
          />
        </div>

        {filteredVehicles.length === 0 ? (
          <EmptyState
            icon={<TruckIcon size={26} />}
            title={query ? 'No matches' : 'No vehicles yet'}
            message={query ? `Nothing matched “${query.trim()}”.` : 'Add your first vehicle to get started.'}
          />
        ) : (
          <ListSection inset={false} className="stg26">
            {filteredVehicles.map((vehicle) => (
              <ListRow
                key={vehicle.vehicleNumber}
                icon={<TruckIcon size={17} />}
                iconTone={vehicle.isActive === false ? 'neutral' : 'brand'}
                title={vehicle.vehicleNumber}
                subtitle={[vehicle.driverName, vehicle.mobileNumber].filter(Boolean).join(' · ') || '—'}
                badge={
                  vehicle.isActive === false ? <Badge tone="neutral">Inactive</Badge> : null
                }
                chevron
                onClick={() => {
                  setErrors({});
                  setVehicleDraft({
                    id: vehicle.vehicleNumber,
                    vehicleNumber: vehicle.vehicleNumber,
                    driverName: vehicle.driverName || '',
                    mobileNumber: vehicle.mobileNumber || '',
                    vehicleType: vehicle.vehicleType || 'lorry',
                    isActive: vehicle.isActive !== false
                  });
                }}
              />
            ))}
          </ListSection>
        )}
      </Sheet>

      <Sheet
        open={manager === 'villages'}
        onClose={() => setManager(null)}
        title="Villages"
        subtitle={`${villages.length} on record`}
        detent="large"
        primaryAction={
          <Button
            variant="plain"
            onClick={() => {
              setErrors({});
              setVillageDraft({ villageName: '' });
            }}
          >
            Add
          </Button>
        }
      >
        <div className="set__search">
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search villages"
          />
        </div>

        {filteredVillages.length === 0 ? (
          <EmptyState
            title={query ? 'No matches' : 'No villages yet'}
            message={query ? `Nothing matched “${query.trim()}”.` : 'Villages are created as you use them.'}
          />
        ) : (
          <ListSection inset={false} className="stg26">
            {filteredVillages.map((village) => (
              <ListRow
                key={village.id}
                title={village.villageName}
                subtitle={`Used ${village.usageCount || 0} times`}
                chevron
                onClick={() => {
                  setErrors({});
                  setVillageDraft({ id: village.id, villageName: village.villageName });
                }}
              />
            ))}
          </ListSection>
        )}
      </Sheet>

      {/* ----------------------------- edit sheets ---------------------------- */}

      <Sheet
        open={Boolean(vehicleDraft)}
        onClose={() => setVehicleDraft(null)}
        title={vehicleDraft?.id ? 'Edit vehicle' : 'New vehicle'}
        secondaryAction={
          <Button variant="plain" onClick={() => setVehicleDraft(null)}>
            Cancel
          </Button>
        }
        primaryAction={
          <Button variant="plain" loading={saving} onClick={saveVehicle}>
            Save
          </Button>
        }
      >
        {vehicleDraft && (
          <>
            <ListSection inset={false} footer={errors.vehicleNumber || errors.driverName || errors.mobileNumber}>
              <ListRow>
                <TextField
                  label="Number"
                  layout="row"
                  value={vehicleDraft.vehicleNumber}
                  onChange={(e) =>
                    setVehicleDraft((prev) => ({ ...prev, vehicleNumber: e.target.value.toUpperCase() }))
                  }
                  placeholder="KA-00-A-0000"
                  disabled={Boolean(vehicleDraft.id)}
                  autoCapitalize="characters"
                  error={errors.vehicleNumber}
                />
              </ListRow>
              <ListRow>
                <TextField
                  label="Driver"
                  layout="row"
                  value={vehicleDraft.driverName}
                  onChange={(e) => setVehicleDraft((prev) => ({ ...prev, driverName: e.target.value }))}
                  placeholder="Full name"
                  autoCapitalize="words"
                  error={errors.driverName}
                />
              </ListRow>
              <ListRow>
                <PhoneField
                  label="Mobile"
                  layout="row"
                  value={vehicleDraft.mobileNumber}
                  onChange={(e) => setVehicleDraft((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                  placeholder="10 digits"
                  error={errors.mobileNumber}
                />
              </ListRow>
              <ListRow>
                <Picker
                  label="Type"
                  layout="row"
                  value={vehicleDraft.vehicleType}
                  options={VEHICLE_TYPES}
                  onChange={(value) => setVehicleDraft((prev) => ({ ...prev, vehicleType: value }))}
                />
              </ListRow>
              <ListRow
                title="Active"
                accessory={
                  <Switch
                    checked={vehicleDraft.isActive}
                    onChange={(value) => setVehicleDraft((prev) => ({ ...prev, isActive: value }))}
                    label="Vehicle active"
                  />
                }
              />
            </ListSection>

            {vehicleDraft.id && (
              <ListSection inset={false}>
                <ListRow
                  title="Remove vehicle"
                  destructive
                  onClick={() => {
                    const item = vehicleDraft;
                    setVehicleDraft(null);
                    setConfirm({ kind: 'vehicle', item });
                  }}
                />
              </ListSection>
            )}
          </>
        )}
      </Sheet>

      <Sheet
        open={Boolean(villageDraft)}
        onClose={() => setVillageDraft(null)}
        title={villageDraft?.id ? 'Edit village' : 'New village'}
        secondaryAction={
          <Button variant="plain" onClick={() => setVillageDraft(null)}>
            Cancel
          </Button>
        }
        primaryAction={
          <Button variant="plain" loading={saving} onClick={saveVillage}>
            Save
          </Button>
        }
      >
        {villageDraft && (
          <>
            <ListSection inset={false} footer={errors.villageName}>
              <ListRow>
                <TextField
                  label="Name"
                  layout="row"
                  value={villageDraft.villageName}
                  onChange={(e) => setVillageDraft((prev) => ({ ...prev, villageName: e.target.value }))}
                  placeholder="Village name"
                  autoCapitalize="words"
                  error={errors.villageName}
                  data-autofocus
                />
              </ListRow>
            </ListSection>

            {villageDraft.id && (
              <ListSection inset={false}>
                <ListRow
                  title="Remove village"
                  destructive
                  onClick={() => {
                    const item = villageDraft;
                    setVillageDraft(null);
                    setConfirm({ kind: 'village', item });
                  }}
                />
              </ListSection>
            )}
          </>
        )}
      </Sheet>

      {/* Replaces window.confirm */}
      <Alert
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'vehicle' ? 'Remove vehicle?' : 'Remove village?'}
        message={
          confirm?.kind === 'vehicle'
            ? `${confirm?.item?.vehicleNumber} will no longer appear in pickers. Existing trips keep their history.`
            : `${confirm?.item?.villageName} will no longer appear in pickers.`
        }
        confirmLabel="Remove"
        destructive
        onConfirm={runConfirm}
      />

    </div>
  );
};

export default SettingsPage;
