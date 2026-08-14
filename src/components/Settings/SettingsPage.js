import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vehicleService, villageService } from '../../services/firebaseService';
import { Card, ListSection, ListRow, Stat, Skeleton, useToast } from '../../ui';
import { TruckIcon, MapPinIcon } from '../Common/Icons';
import './SettingsPage.css';

/* =============================================================================
   Settings — root.

   This screen is navigation, nothing else. Vehicles and villages are managed on
   their own pushed screens at /settings/vehicles and /settings/villages.

   Why pushed screens rather than sheets: the previous version opened a manager
   sheet from this list and then an editor sheet *from inside that sheet*. Apple's
   own Settings never does that — Settings > Mail > Accounts > Add Account is a
   navigation stack. Modally stacking two sheets doubled the scrim, ran two focus
   traps against each other, and made Escape collapse the whole stack. Pushing
   gets a real Back button, working browser back, deep links, and one modal layer
   at a time.

   The add actions live on the screen that owns the data, not here.
   ========================================================================== */

const SettingsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Inactive records included, so the counts here match what the management
      // screens actually show.
      const [vehicleList, villageList] = await Promise.all([
        vehicleService.getAllVehicles(true),
        villageService.getAllVillages(true)
      ]);
      setVehicles(vehicleList || []);
      setVillages(villageList || []);
    } catch (error) {
      console.error('Error loading fleet data:', error);
      toast.error('Could not load fleet data');
    } finally {
      setLoading(false);
    }
    // toast identity is stable from the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      vehicles: vehicles.length,
      activeVehicles: vehicles.filter((vehicle) => vehicle.isActive !== false).length,
      villages: villages.filter((village) => village.isActive !== false).length
    }),
    [vehicles, villages]
  );

  if (loading) {
    return (
      <div className="set">
        <div className="set__skeleton">
          <Skeleton height={78} radius="var(--r-lg)" />
          <Skeleton height={132} radius="var(--r-lg)" />
          <Skeleton height={88} radius="var(--r-lg)" />
        </div>
      </div>
    );
  }

  return (
    <div className="set">
      <Card className="set__summary">
        <Stat value={counts.vehicles} label="Vehicles" />
        <span className="set__summary-divider" aria-hidden="true" />
        <Stat value={counts.activeVehicles} label="Active" tone="success" dot />
        <span className="set__summary-divider" aria-hidden="true" />
        <Stat value={counts.villages} label="Villages" />
      </Card>

      <ListSection header="Fleet" footer="Vehicles and villages feed the pickers on the trip form.">
        <ListRow
          icon={<TruckIcon size={17} />}
          iconTone="brand"
          title="Vehicles"
          subtitle={`${counts.vehicles} on record`}
          value={`${counts.activeVehicles} active`}
          chevron
          onClick={() => navigate('/settings/vehicles')}
        />
        <ListRow
          icon={<MapPinIcon size={17} />}
          iconTone="accent"
          title="Villages"
          subtitle={`${counts.villages} on record`}
          chevron
          onClick={() => navigate('/settings/villages')}
        />
      </ListSection>

      <ListSection header="About">
        <ListRow title="App" value="Suhel Roadlines" />
        <ListRow title="Data" value="Firestore + Realtime cache" />
      </ListSection>
    </div>
  );
};

export default SettingsPage;
