import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, villageService } from '../../services/firebaseService';
import { formatINR, relativeDayLabel, isStrReceived } from '../../services/homeService';
import { Sheet, SearchField, Segmented, ListSection, ListRow, Badge, EmptyState } from '../../ui';
import { TruckIcon, DocCheckIcon, DocAlertIcon } from './Icons';
import './SearchOverlay.css';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'trips', label: 'Trips' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'villages', label: 'Villages' }
];

/**
 * In-app search. Built on the Sheet primitive so it portals to <body> and can
 * never be trapped behind the tab bar by shell layout. Reads from the fastSync
 * cache, so results appear as you type with no network round trip.
 */
const SearchOverlay = ({ open, onClose }) => {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState({ trips: [], vehicles: [], villages: [] });

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    Promise.allSettled([
      tripService.getAllTrips(),
      vehicleService.getAllVehicles(),
      villageService.getAllVillages()
    ]).then(([trips, vehicles, villages]) => {
      if (cancelled) return;
      setData({
        trips: trips.status === 'fulfilled' ? trips.value || [] : [],
        vehicles: vehicles.status === 'fulfilled' ? vehicles.value || [] : [],
        villages: villages.status === 'fulfilled' ? villages.value || [] : []
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setFilter('all');
    }
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return { trips: [], vehicles: [], villages: [] };

    const matches = (...fields) =>
      fields.some((field) => String(field ?? '').toLowerCase().includes(term));

    return {
      trips:
        filter === 'all' || filter === 'trips'
          ? data.trips
              .filter((trip) =>
                matches(
                  trip.vehicleNumber,
                  trip.driverName,
                  trip.mobileNumber,
                  trip.slNumber,
                  (trip.villages || []).join(' ')
                )
              )
              .slice(0, 25)
          : [],
      vehicles:
        filter === 'all' || filter === 'vehicles'
          ? data.vehicles
              .filter((v) => matches(v.vehicleNumber, v.driverName, v.mobileNumber))
              .slice(0, 15)
          : [],
      villages:
        filter === 'all' || filter === 'villages'
          ? data.villages.filter((v) => matches(v.villageName)).slice(0, 15)
          : []
    };
  }, [query, filter, data]);

  const total = results.trips.length + results.vehicles.length + results.villages.length;
  const trimmed = query.trim();

  const go = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Search" detent="large" className="srch-sheet">
      <div className="srch-sheet__controls">
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Vehicle, driver, mobile, village"
          data-autofocus
        />
        <Segmented options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Search scope" />
      </div>

      {!trimmed && (
        <EmptyState title="Search everything" message="Trips, vehicles, drivers, mobile numbers and villages." />
      )}

      {trimmed && total === 0 && (
        <EmptyState title="No matches" message={`Nothing matched “${trimmed}”.`} />
      )}

      {results.trips.length > 0 && (
        <ListSection header="Trips" inset={false} className="srch-sheet__group">
          {results.trips.map((trip) => {
            const paid = isStrReceived(trip);
            return (
              <ListRow
                key={trip.id}
                icon={paid ? <DocCheckIcon size={17} /> : <DocAlertIcon size={17} />}
                iconTone={paid ? 'success' : 'danger'}
                title={`${trip.vehicleNumber}${trip.slNumber ? ` · #${trip.slNumber}` : ''}`}
                subtitle={`${trip.driverName || 'No driver'} · ${relativeDayLabel(trip.date)}`}
                badge={<Badge tone={paid ? 'success' : 'danger'}>{paid ? 'Paid' : 'Due'}</Badge>}
                onClick={() => go(paid ? '/str-status?filter=paid' : '/str-status?filter=due')}
                chevron
              />
            );
          })}
        </ListSection>
      )}

      {results.vehicles.length > 0 && (
        <ListSection header="Vehicles" inset={false} className="srch-sheet__group">
          {results.vehicles.map((vehicle) => (
            <ListRow
              key={vehicle.vehicleNumber}
              icon={<TruckIcon size={17} />}
              iconTone="brand"
              title={vehicle.vehicleNumber}
              subtitle={`${vehicle.driverName || 'No driver'}${
                vehicle.mobileNumber ? ` · ${vehicle.mobileNumber}` : ''
              }`}
              onClick={() => go('/settings')}
              chevron
            />
          ))}
        </ListSection>
      )}

      {results.villages.length > 0 && (
        <ListSection header="Villages" inset={false} className="srch-sheet__group">
          {results.villages.map((village) => (
            <ListRow
              key={village.id}
              title={village.villageName}
              subtitle={`Used ${village.usageCount || 0} times`}
              onClick={() => go('/settings')}
              chevron
            />
          ))}
        </ListSection>
      )}

      {trimmed && results.trips.length > 0 && (
        <p className="srch-sheet__total">
          {results.trips.length} trip{results.trips.length === 1 ? '' : 's'} ·{' '}
          {formatINR(results.trips.reduce((sum, t) => sum + (Number(t.advanceAmount) || 0), 0))} advance
        </p>
      )}
    </Sheet>
  );
};

export default SearchOverlay;
