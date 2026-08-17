import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tripService } from '../../services/firebaseService';
import { isStrReceived, formatINR, toDate } from '../../services/homeService';
import { formatVehicleNumber } from '../../services/textService';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Button,
  Segmented,
  DateField,
  SearchField,
  ListSection,
  ListRow,
  Badge,
  Card,
  Stat,
  EmptyState,
  Skeleton,
  Sheet,
  useToast
} from '../../ui';
import useCommitAction from '../Layout/useCommitAction';
import { isFirebaseAvailable } from '../../firebase/config';
import { DocAlertIcon, DocCheckIcon, CalendarIcon, ChevronDownIcon } from '../Common/Icons';
import './SimpleSTRStatus.css';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'paid', label: 'Received' }
];

const formatDate = (value) => {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  return isNaN(date.getTime()) ? '' : format(date, 'dd MMM yyyy');
};

const SimpleSTRStatus = () => {
  const toast = useToast();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [filterSheet, setFilterSheet] = useState(false);
  const [vehicleQuery, setVehicleQuery] = useState('');

  const [filters, setFilters] = useState({
    dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // ?filter=due|paid|all — set by the home quick actions and by search results
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = STATUS_TABS.some((tab) => tab.value === searchParams.get('filter'))
    ? searchParams.get('filter')
    : 'all';

  const setStatusFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('filter');
    else next.set('filter', value);
    setSearchParams(next, { replace: true });
  };

  // Last known saved state, so Cancel can restore it without a round trip.
  const baseline = useRef([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = new Date(filters.dateFrom);
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);

      const loaded = await tripService.getTripsByDateRange(startDate, endDate);
      baseline.current = loaded;
      setTrips(loaded);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Could not load trips');
    } finally {
      setLoading(false);
    }
    // toast identity is stable from the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // The STR tab badge counts every outstanding STR across all dates, but this
  // screen opens scoped to the current month. Clicking through from the badge
  // when a pending STR fell in another month used to land on an empty list —
  // the July trip vanished in an August view even though the badge still said
  // "1 due". On first load, widen the range to span every outstanding STR so
  // the badge and the list agree. Once only: the date sheet owns range changes
  // after that.
  const widenedForDues = useRef(false);
  useEffect(() => {
    if (widenedForDues.current) return;
    let cancelled = false;

    tripService
      .getAllTrips()
      .then((all) => {
        if (cancelled) return;
        const dueDates = all
          .filter((trip) => !isStrReceived(trip))
          .map((trip) => toDate(trip.date))
          .filter(Boolean);
        if (!dueDates.length) return;

        const earliest = Math.min(...dueDates.map((date) => date.getTime()));
        const latest = Math.max(...dueDates.map((date) => date.getTime()));

        const from = new Date(filters.dateFrom).getTime();
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);

        if (earliest < from || latest > to.getTime()) {
          widenedForDues.current = true;
          setFilters({
            dateFrom: format(new Date(earliest), 'yyyy-MM-dd'),
            dateTo: format(new Date(latest), 'yyyy-MM-dd')
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // Intentionally once on mount, against the initial month range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      all: trips.length,
      due: trips.filter((trip) => !isStrReceived(trip)).length,
      paid: trips.filter(isStrReceived).length
    }),
    [trips]
  );

  const visibleTrips = useMemo(() => {
    const term = vehicleQuery.trim().toLowerCase();

    return trips.filter((trip) => {
      if (statusFilter === 'due' && isStrReceived(trip)) return false;
      if (statusFilter === 'paid' && !isStrReceived(trip)) return false;
      if (term) {
        const haystack = `${trip.vehicleNumber || ''} ${trip.driverName || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [trips, statusFilter, vehicleQuery]);

  const dueTotal = useMemo(
    () =>
      trips
        .filter((trip) => !isStrReceived(trip))
        .reduce((sum, trip) => sum + (Number(trip.advanceAmount) || 0), 0),
    [trips]
  );

  const toggleStatus = (trip) => {
    const next = isStrReceived(trip) ? 'not received' : 'Received';
    setTrips((current) =>
      current.map((item) => (item.id === trip.id ? { ...item, strStatus: next, strNumber: next } : item))
    );
    setDirtyIds((current) => new Set(current).add(trip.id));
  };

  const saveChanges = async () => {
    if (!dirtyIds.size) return;
    setSaving(true);
    const startedAt = performance.now();

    try {
      // Only the rows the user touched, and each resolves as soon as it is
      // durable in the Realtime DB cache.
      const edited = trips.filter((trip) => dirtyIds.has(trip.id));
      await Promise.all(
        edited.map((trip) => tripService.updateSTRStatus(trip.id, trip.strStatus || 'not received'))
      );

      const ms = Math.round(performance.now() - startedAt);
      toast.success(`Saved ${edited.length} update${edited.length === 1 ? '' : 's'} in ${ms} ms`);
      baseline.current = trips;
      setDirtyIds(new Set());
    } catch (error) {
      console.error('Error updating STR status:', error);
      // Surface the real reason. The generic message hid the one failure that
      // actually happens here — Firestore unavailable — which needs a fix in
      // .env.local, not a retry. Edits stay pending so nothing is lost.
      toast.error(
        isFirebaseAvailable
          ? error?.message || 'Could not save STR status'
          : 'Not connected to Firebase, so nothing was saved. Your edits are still here.'
      );
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setTrips(baseline.current);
    setDirtyIds(new Set());
  };

  const pending = dirtyIds.size;

  // Nothing to commit until a row is touched, so the nav bar only takes over
  // once there are pending edits. Search and notifications come back on save.
  useCommitAction({
    token: 'str-status',
    active: pending > 0,
    status: `${pending} unsaved`,
    commitLabel: 'Save',
    busy: saving,
    onCommit: saveChanges,
    onCancel: discardChanges
  });

  const resetFilters = () => {
    setFilters({
      dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });
    setVehicleQuery('');
  };

  const rangeLabel = `${formatDate(filters.dateFrom)} – ${formatDate(filters.dateTo)}`;

  return (
    <div className="str">
      <div className="str__toolbar">
        <SearchField
          value={vehicleQuery}
          onChange={(e) => setVehicleQuery(e.target.value)}
          placeholder="Filter by vehicle or driver"
        />

        <Segmented
          options={STATUS_TABS.map((tab) => ({ ...tab, count: counts[tab.value] }))}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="STR status"
        />

        <button
          type="button"
          className="str__range"
          onClick={() => setFilterSheet(true)}
          aria-haspopup="dialog"
          aria-expanded={filterSheet}
          aria-label={`Date range, ${rangeLabel}. Change`}
        >
          <CalendarIcon size={15} />
          <span>{rangeLabel}</span>
          <ChevronDownIcon size={13} className="str__range-chevron" />
        </button>
      </div>

      {!isFirebaseAvailable && (
        <div className="str__offline" role="status">
          <span className="str__offline-icon" aria-hidden="true">
            <DocAlertIcon size={17} />
          </span>
          <span>
            <strong>Working from local sample data.</strong> Firebase config was not picked up, so
            STR changes cannot be saved. Restart the dev server so it reads <code>.env.local</code>.
          </span>
        </div>
      )}

      {counts.due > 0 && (
        <Card className="str__summary">
          <Stat value={counts.due} label="STR pending" tone="danger" dot />
          <span className="str__summary-divider" aria-hidden="true" />
          <Stat value={formatINR(dueTotal)} label="Advance at risk" />
        </Card>
      )}

      {loading ? (
        <div className="str__skeleton">
          <Skeleton height={66} radius="var(--r-lg)" />
          <Skeleton height={66} radius="var(--r-lg)" />
          <Skeleton height={66} radius="var(--r-lg)" />
        </div>
      ) : visibleTrips.length === 0 ? (
        <Card padded={false} className="str__empty">
          <EmptyState
            icon={<DocCheckIcon size={26} />}
            title="No trips here"
            message={
              statusFilter === 'due'
                ? 'Every STR in this range is received.'
                : 'Try a wider date range or clear the filter.'
            }
            action={
              <Button variant="tinted" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        </Card>
      ) : (
        <ListSection
          header={`${visibleTrips.length} trip${visibleTrips.length === 1 ? '' : 's'}`}
          footer="Tap a row to flip its STR status, then Save at the top right. Changes save together."
          className="stg26"
          key={statusFilter}
        >
          {visibleTrips.map((trip) => {
            const received = isStrReceived(trip);
            const dirty = dirtyIds.has(trip.id);

            return (
              <ListRow
                key={trip.id}
                thumbnail={trip.imageUrl || undefined}
                icon={received ? <DocCheckIcon size={17} /> : <DocAlertIcon size={17} />}
                iconTone={received ? 'success' : 'danger'}
                /* Uppercased for display: records written before input
                   normalisation existed can still be mixed case, and a plate is
                   uppercase on every permit and STR. */
                title={formatVehicleNumber(trip.vehicleNumber)}
                subtitle={`#${trip.slNumber ?? '—'} · ${trip.driverName || 'No driver'}`}
                detail={formatDate(trip.date)}
                badge={
                  <Badge tone={received ? 'success' : 'danger'} dot>
                    {received ? 'Received' : 'Due'}
                  </Badge>
                }
                accessory={dirty ? <span className="str__dirty" aria-label="Unsaved" /> : null}
                onClick={() => toggleStatus(trip)}
                className={dirty ? 'is-dirty' : ''}
              />
            );
          })}
        </ListSection>
      )}

      {/* No bottom action bar. Save and Cancel live in the nav bar for the
          duration of the edit session — see components/Layout/editSession.js. */}

      <Sheet
        open={filterSheet}
        onClose={() => setFilterSheet(false)}
        title="Date range"
        primaryAction={
          <Button variant="plain" onClick={() => setFilterSheet(false)}>
            Done
          </Button>
        }
        secondaryAction={
          <Button variant="plain" onClick={resetFilters}>
            Reset
          </Button>
        }
      >
        <ListSection inset={false}>
          <ListRow>
            <DateField
              label="From"
              layout="row"
              value={filters.dateFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />
          </ListRow>
          <ListRow>
            <DateField
              label="To"
              layout="row"
              value={filters.dateTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </ListRow>
        </ListSection>
      </Sheet>
    </div>
  );
};

export default SimpleSTRStatus;
