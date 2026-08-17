import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CSVLink } from 'react-csv';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  differenceInCalendarDays
} from 'date-fns';
import { tripService, vehicleService, advanceService, villageService } from '../../services/firebaseService';
import {
  toDate,
  isStrReceived,
  formatINR,
  formatCompactINR,
  joinTripAdvances,
  advanceWhen
} from '../../services/homeService';
import { VEHICLE_TYPES } from '../../types';
import {
  normaliseVehicleNumber,
  formatVehicleNumber,
  normaliseVillageName,
  suggestVillageCode,
  titleCase,
  mobileError,
  sameText
} from '../../services/textService';
import {
  Button,
  Card,
  SectionHeader,
  Segmented,
  SearchField,
  DateField,
  TextField,
  NumberField,
  PhoneField,
  CurrencyField,
  Picker,
  ListSection,
  ListRow,
  Badge,
  Stat,
  EmptyState,
  Skeleton,
  Sheet,
  Alert,
  BarChart,
  ImagePicker,
  TextArea,
  useToast
} from '../../ui';
import {
  TruckIcon,
  WalletIcon,
  DocCheckIcon,
  DocAlertIcon,
  CalendarIcon,
  ChevronDownIcon,
  TrendUpIcon,
  ChartIcon
} from '../Common/Icons';
import './ReportsPage.css';

/* =============================================================================
   Reports.

   The screen answers one question — "how did this period go, and which trips
   need attention?" — and it answers it in the order Apple's chart guidance
   prescribes (WWDC22 "Design an effective chart" and "Design app experiences
   with charts"): a description that states the take-away in words and a
   concrete number, then the chart, then the detail.

   Reading order, and why:
     1  range control      scopes everything below it, so it comes first
     2  take-away card     the one number, plus a comparison so it means
                           something. A chart's description should be
                           informative read on its own
     3  chart              pattern over time, one measure at a time
     4  stat row           secondary magnitudes; not the take-away
     5  vehicle breakdown  "unique vehicles: 4" is a dead end. Which vehicles,
                           and how much each, is the actionable version
     6  records            the individual values, tap for the full detail
     7  export             a terminal action, so it sits at the end

   Cost: trips and advances are each read once per mount from the fastSync
   cache. Everything after that is derived in memos — O(T + A) to join once,
   then O(T) per filter keystroke with no network at all. The old version
   refetched both collections on every keystroke and ran the advance join twice.
   ========================================================================== */

const RANGES = [
  { value: 'today', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' }
];

/* "Trip count" rather than "Trips": the records section below already has a
   Trips tab, and two controls on one screen with the same accessible name is
   ambiguous for screen readers and for anyone reading the labels. */
const MEASURES = [
  { value: 'advance', label: 'Advance' },
  { value: 'trips', label: 'Trip count' },
  { value: 'quantity', label: 'Quantity' }
];

const TABS = [
  { value: 'trips', label: 'Trips' },
  { value: 'advances', label: 'Advances' }
];

const STR_OPTIONS = [
  { value: 'not received', label: 'Due' },
  { value: 'Received', label: 'Received' }
];

const TYPE_OPTIONS = VEHICLE_TYPES.map((type) => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1)
}));

/** `new Date('2026-08-01')` is UTC midnight, which shifts the boundary a day in
    IST. Parse the parts so a date input means that day, locally. */
const parseLocalDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const iso = (date) => format(date, 'yyyy-MM-dd');

/** Current and preceding window for a range key. The comparison window is the
    real previous calendar period, not just "minus N days", so "vs last month"
    is honest for months of unequal length. */
const resolveWindow = (range, custom) => {
  const now = new Date();

  switch (range) {
    case 'today':
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        prevFrom: startOfDay(subDays(now, 1)),
        prevTo: endOfDay(subDays(now, 1)),
        comparisonLabel: 'yesterday'
      };
    case 'week':
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        prevFrom: startOfDay(subDays(now, 13)),
        prevTo: endOfDay(subDays(now, 7)),
        comparisonLabel: 'previous week'
      };
    case 'year':
      return {
        from: startOfYear(now),
        to: endOfYear(now),
        prevFrom: startOfYear(subYears(now, 1)),
        prevTo: endOfYear(subYears(now, 1)),
        comparisonLabel: 'last year'
      };
    case 'custom': {
      const from = startOfDay(parseLocalDate(custom.from) || startOfMonth(now));
      const to = endOfDay(parseLocalDate(custom.to) || endOfMonth(now));
      const span = Math.max(0, differenceInCalendarDays(to, from));
      return {
        from,
        to,
        prevFrom: startOfDay(subDays(from, span + 1)),
        prevTo: endOfDay(subDays(from, 1)),
        comparisonLabel: 'previous period'
      };
    }
    case 'month':
    default:
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        prevFrom: startOfMonth(subMonths(now, 1)),
        prevTo: endOfMonth(subMonths(now, 1)),
        comparisonLabel: 'last month'
      };
  }
};

const inWindow = (value, from, to) => {
  const when = toDate(value)?.getTime();
  if (when == null) return false;
  return when >= from.getTime() && when <= to.getTime();
};

/* `advanceWhen` — an advance belongs to the period it was advanced *for*,
   falling back to when it was recorded. The old page filtered trips on `date`
   but advances on `createdAt`, so an advance logged late silently left the
   totals. Shared from homeService, because the vehicle file screens have to date
   an advance the same way or their totals will not match these. */

const measureOf = (trip, measure) => {
  if (measure === 'trips') return 1;
  if (measure === 'quantity') return Number(trip.quantity) || 0;
  return Number(trip.totalAdvances) || 0;
};

const ReportsPage = () => {
  const toast = useToast();

  const [trips, setTrips] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Helper: check if a trip/advance belongs to an own vehicle. */
  const isOwnTrip = useCallback(
    (record) => {
      const vehicle = vehicles.find((v) => sameText(v.vehicleNumber, record.vehicleNumber));
      return vehicle?.isOwn === true;
    },
    [vehicles]
  );

  const [measure, setMeasure] = useState('advance');
  const [query, setQuery] = useState('');
  const [selectedBar, setSelectedBar] = useState(null);

  const [rangeSheet, setRangeSheet] = useState(false);
  const [custom, setCustom] = useState({
    from: iso(startOfMonth(new Date())),
    to: iso(endOfMonth(new Date()))
  });

  const [detailTrip, setDetailTrip] = useState(null);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  /* --------------------------------------------------------------- routing */
  // ?range=today|week|month|year and ?tab=trips|advances, written back on
  // interaction so a deep link and the visible state never disagree.
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeParam = searchParams.get('range');
  const range = RANGES.some((item) => item.value === rangeParam) || rangeParam === 'custom'
    ? rangeParam
    : 'month';

  const tabParam = searchParams.get('tab');
  const tab = TABS.some((item) => item.value === tabParam) ? tabParam : 'trips';

  const setParam = useCallback(
    (key, value, fallback) => {
      const next = new URLSearchParams(searchParams);
      if (value === fallback) next.delete(key);
      else next.set(key, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setRange = (value) => setParam('range', value, 'month');
  const setTab = (value) => setParam('tab', value, 'trips');

  /* ------------------------------------------------------------------ load */

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Four cache-backed reads, once. Range and search are applied in memos
      // below, so changing either costs nothing.
      const [tripList, advanceList, vehicleList, villageList] = await Promise.all([
        tripService.getAllTrips(),
        advanceService.getAllAdvances(),
        vehicleService.getAllVehicles(),
        villageService.getAllVillages().catch(() => [])
      ]);

      setTrips(tripList || []);
      setAdvances(advanceList || []);
      setVehicles(vehicleList || []);
      setVillages(villageList || []);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Could not load reports');
    } finally {
      setLoading(false);
    }
    // toast identity is stable from the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------------ join */

  // One pass to index advances by trip, then one pass over trips. Lives in
  // homeService so the vehicle file screens compute the same figure from the
  // same fields — two screens deriving "what this trip was advanced" separately
  // is how the old Reports page came to disagree with itself.
  const joined = useMemo(() => joinTripAdvances(trips, advances), [trips, advances]);

  /* ---------------------------------------------------------------- window */

  const win = useMemo(() => resolveWindow(range, custom), [range, custom]);

  const periodTrips = useMemo(
    () => joined.trips.filter((trip) => inWindow(trip.date, win.from, win.to)),
    [joined.trips, win]
  );

  const previousTrips = useMemo(
    () => joined.trips.filter((trip) => inWindow(trip.date, win.prevFrom, win.prevTo)),
    [joined.trips, win]
  );

  const periodAdvances = useMemo(
    () => joined.advances.filter((item) => inWindow(advanceWhen(item), win.from, win.to)),
    [joined.advances, win]
  );

  /* ---------------------------------------------------------------- search */

  // One field instead of the old pair of text inputs, matched against every
  // field someone would plausibly type. Applied to both tabs, unlike before.
  const matches = useCallback(
    (haystack) => {
      const term = query.trim().toLowerCase();
      if (!term) return true;
      return haystack.toLowerCase().includes(term);
    },
    [query]
  );

  const visibleTrips = useMemo(
    () =>
      periodTrips.filter((trip) =>
        matches(
          `${trip.vehicleNumber || ''} ${trip.driverName || ''} ${(trip.villages || []).join(' ')} ${
            trip.slNumber ?? ''
          }`
        )
      ),
    [periodTrips, matches]
  );

  const visibleAdvances = useMemo(
    () =>
      periodAdvances.filter((item) =>
        matches(`${item.vehicleNumber || ''} ${item.note || ''} ${item.advanceType || ''}`)
      ),
    [periodAdvances, matches]
  );

  /* --------------------------------------------------------------- summary */

  const totals = useMemo(() => {
    const advance = visibleTrips.reduce((sum, trip) => sum + trip.totalAdvances, 0);
    const quantity = visibleTrips.reduce((sum, trip) => sum + (Number(trip.quantity) || 0), 0);
    return {
      advance,
      quantity,
      trips: visibleTrips.length,
      vehicles: new Set(visibleTrips.map((trip) => trip.vehicleNumber)).size,
      // Computed by the old page and then never shown. It is the most useful of
      // the four, so it is on screen now.
      avgPerTrip: visibleTrips.length ? advance / visibleTrips.length : 0,
      strDue: visibleTrips.filter((trip) => !isStrReceived(trip)).length
    };
  }, [visibleTrips]);

  const previousTotal = useMemo(
    () => previousTrips.reduce((sum, trip) => sum + measureOf(trip, measure), 0),
    [previousTrips, measure]
  );

  const currentTotal = useMemo(
    () => visibleTrips.reduce((sum, trip) => sum + measureOf(trip, measure), 0),
    [visibleTrips, measure]
  );

  // "Sales are up 12%" tells you whether the number is good. The bare number
  // does not.
  const delta = useMemo(() => {
    if (!previousTotal) return null;
    const change = ((currentTotal - previousTotal) / previousTotal) * 100;
    if (!Number.isFinite(change)) return null;
    return { pct: Math.abs(Math.round(change)), up: change >= 0 };
  }, [currentTotal, previousTotal]);

  /* ----------------------------------------------------------------- chart */

  // A single day would be a one-bar chart, which shows no pattern at all, so the
  // Day range plots the trailing week for context and says so in the caption.
  // The chart therefore has its own window, and pulls its own trips for it —
  // the totals above stay bound to the selected period.
  const buckets = useMemo(() => {
    const monthly = range === 'year' || differenceInCalendarDays(win.to, win.from) > 62;
    const from = range === 'today' ? startOfDay(subDays(win.to, 6)) : win.from;

    const slots = monthly
      ? eachMonthOfInterval({ start: from, end: win.to })
      : eachDayOfInterval({ start: from, end: win.to });

    const keyOf = (date) => (monthly ? format(date, 'yyyy-MM') : format(date, 'yyyy-MM-dd'));

    const source = joined.trips.filter(
      (trip) =>
        inWindow(trip.date, from, win.to) &&
        matches(
          `${trip.vehicleNumber || ''} ${trip.driverName || ''} ${(trip.villages || []).join(' ')} ${
            trip.slNumber ?? ''
          }`
        )
    );

    const tally = new Map();
    for (const trip of source) {
      const when = toDate(trip.date);
      if (!when) continue;
      const key = keyOf(when);
      tally.set(key, (tally.get(key) || 0) + measureOf(trip, measure));
    }

    const unit = measure === 'advance' ? '' : measure === 'trips' ? 'trips' : 'units';

    return {
      monthly,
      caption: monthly
        ? `${format(from, 'MMM yyyy')} – ${format(win.to, 'MMM yyyy')}`
        : range === 'today'
        ? 'Last 7 days'
        : `${format(from, 'd MMM')} – ${format(win.to, 'd MMM')}`,
      points: slots.map((date) => {
        const key = keyOf(date);
        const value = tally.get(key) || 0;
        const longLabel = monthly ? format(date, 'MMMM yyyy') : format(date, 'd MMMM');
        const spoken =
          measure === 'advance' ? formatINR(value) : `${value} ${unit}`.trim();

        return {
          key,
          value,
          label: longLabel,
          shortLabel: monthly ? format(date, 'MMM') : format(date, 'd'),
          // Date first, words spelled out, axis names left out — VoiceOver
          // guidance from the same session.
          a11yLabel: `${longLabel}, ${spoken}`
        };
      })
    };
  }, [joined.trips, matches, win, range, measure]);

  const selectedPoint = buckets.points.find((point) => point.key === selectedBar) || null;

  // Judged on the chart's own window, not the selected period. The Day range
  // plots a trailing week, so "no trips today" must not blank out a week that
  // does have data.
  const chartHasData = buckets.points.some((point) => point.value > 0);

  // Selecting a bar in one measure and switching measure would leave a readout
  // describing the wrong thing.
  useEffect(() => setSelectedBar(null), [measure, range, query]);

  /* ------------------------------------------------------- vehicle split */

  const byVehicle = useMemo(() => {
    const tally = new Map();
    for (const trip of visibleTrips) {
      const key = trip.vehicleNumber || 'Unknown';
      const entry = tally.get(key) || { vehicleNumber: key, value: 0, trips: 0, driverName: trip.driverName };
      entry.value += measureOf(trip, measure);
      entry.trips += 1;
      tally.set(key, entry);
    }

    const rows = [...tally.values()].sort((a, b) => b.value - a.value);
    const top = rows[0]?.value || 0;
    return rows.slice(0, 5).map((row) => ({ ...row, share: top ? (row.value / top) * 100 : 0 }));
  }, [visibleTrips, measure]);

  /* ------------------------------------------------------------ formatting */

  const formatMeasure = useCallback(
    (value) => {
      if (measure === 'advance') return formatINR(value);
      if (measure === 'trips') return `${value} ${value === 1 ? 'trip' : 'trips'}`;
      return `${Number(value.toFixed(2))}`;
    },
    [measure]
  );

  const formatAxis = useCallback(
    (value) => (measure === 'advance' ? formatCompactINR(value) : String(Math.round(value))),
    [measure]
  );

  const measureHeadline = measure === 'advance' ? formatINR(currentTotal) : formatMeasure(currentTotal);
  const measureName =
    measure === 'advance' ? 'Advance' : measure === 'trips' ? 'Trips' : 'Quantity';

  const rangeLabel = useMemo(() => {
    if (range === 'today') return format(win.from, 'd MMMM yyyy');
    if (range === 'year') return format(win.from, 'yyyy');
    if (range === 'month') return format(win.from, 'MMMM yyyy');
    return `${format(win.from, 'd MMM')} – ${format(win.to, 'd MMM yyyy')}`;
  }, [range, win]);

  const dateText = (value) => {
    const date = toDate(value);
    return date ? format(date, 'd MMM yyyy') : '—';
  };

  /* ------------------------------------------------------------ edit / del */

  const openEdit = (trip) => {
    const when = toDate(trip.date);
    setDraft({
      slNumber: trip.slNumber ?? '',
      date: when ? iso(when) : '',
      vehicleNumber: trip.vehicleNumber || '',
      // Bound to strStatus, and saved to both fields. The old modal wrote a
      // status string into strNumber, so editing it changed nothing visible and
      // corrupted the number.
      strStatus: isStrReceived(trip) ? 'Received' : 'not received',
      vehicleType: trip.vehicleType || 'lorry',
      villages: trip.villages || [],
      quantity: trip.quantity ?? '',
      driverName: trip.driverName || '',
      mobileNumber: trip.mobileNumber || '',
      advanceAmount: trip.advanceAmount ?? '',
      images: Array.isArray(trip.images) ? trip.images : (trip.imageUrl ? [trip.imageUrl] : []),
      note: trip.note || ''
    });
    setErrors({});
  };

  const validate = (values) => {
    const next = {};
    if (!String(values.vehicleNumber).trim()) next.vehicleNumber = 'Vehicle number is required';
    if (!values.date) next.date = 'Date is required';
    if (!values.villages.length) next.villages = 'Add at least one village';
    if (!values.quantity || parseFloat(values.quantity) <= 0) next.quantity = 'Enter a quantity';
    // Driver name and mobile are both optional: a trip is often recorded before
    // the driver is assigned. Optional, but validated when present.
    // See services/textService.js.
    const mobileProblem = mobileError(values.mobileNumber);
    if (mobileProblem) next.mobileNumber = mobileProblem;
    if (values.advanceAmount !== '' && parseFloat(values.advanceAmount) < 0)
      next.advanceAmount = 'Advance cannot be negative';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveEdit = async () => {
    if (!detailTrip || !draft) return;
    if (!validate(draft)) {
      toast.error('Check the highlighted fields');
      return;
    }

    setSaving(true);
    try {
      const nextAdvance = parseFloat(draft.advanceAmount) || 0;
      const previousAdvance = Number(detailTrip.advanceAmount) || 0;
      const difference = nextAdvance - previousAdvance;
      const when = parseLocalDate(draft.date) || new Date();
      // Settled once, and reused: the trip, its advance and the vehicle book all
      // have to agree on the number, or the trip stops matching its own vehicle.
      const number = formatVehicleNumber(draft.vehicleNumber);

      await tripService.updateTrip(detailTrip.id, {
        slNumber: parseInt(draft.slNumber, 10) || detailTrip.slNumber || 0,
        date: when,
        vehicleNumber: number,
        vehicleType: draft.vehicleType,
        // Written together, because isStrReceived() reads either field.
        strStatus: draft.strStatus,
        strNumber: draft.strStatus,
        villages: draft.villages,
        quantity: parseFloat(draft.quantity),
        driverName: titleCase(draft.driverName),
        mobileNumber: String(draft.mobileNumber).trim(),
        advanceAmount: nextAdvance,
        images: draft.images || [],
        note: draft.note.trim()
      });

      if (difference > 0) {
        await advanceService.addAdvance({
          tripId: detailTrip.id,
          vehicleNumber: number,
          tripDate: when,
          advanceAmount: difference,
          advanceType: 'additional',
          note: `Top-up from a trip edit (${formatINR(previousAdvance)} → ${formatINR(nextAdvance)})`,
          createdAt: new Date()
        });
      } else if (difference < 0) {
        // The old page created nothing here, so the ledger drifted from the
        // trip's own figure with no trace. Say so instead of hiding it.
        toast('Advance reduced on the trip. The advance ledger was left unchanged.');
      }

      /* Keep the vehicle book in step, without letting a cleared field erase
         what is on file. Now that the driver fields are optional, the old
         `known.driverName !== draft.driverName` comparison was true on every
         save (undefined vs '') and merged blanks over real values. `isOwn` is
         left out on purpose: ownership is not decided from a trip edit. */
      const driverName = titleCase(draft.driverName);
      const mobileNumber = String(draft.mobileNumber).trim();
      const known = vehicles.find((item) => sameText(item.vehicleNumber, number));

      const changes = {};
      if (driverName && !sameText(known?.driverName, driverName)) changes.driverName = driverName;
      if (mobileNumber && String(known?.mobileNumber || '') !== mobileNumber)
        changes.mobileNumber = mobileNumber;

      if (!known || Object.keys(changes).length) {
        await vehicleService.addVehicle({
          vehicleNumber: number,
          vehicleType: draft.vehicleType,
          ...changes,
          isActive: true
        });
      }

      toast.success(`Trip #${draft.slNumber || detailTrip.slNumber} updated`);
      setDraft(null);
      setDetailTrip(null);
      await load();
    } catch (error) {
      console.error('Error updating trip:', error);
      toast.error(error?.message || 'Could not update the trip');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const trip = pendingDelete;
    if (!trip) return;

    try {
      await tripService.deleteTrip(trip.id);
      toast.success(`Trip #${trip.slNumber ?? ''} deleted`.replace('# ', ''));
      setDetailTrip(null);
      await load();
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error(error?.message || 'Could not delete the trip');
    } finally {
      setPendingDelete(null);
    }
  };

  /* ------------------------------------------------------------------- csv */

  // Same 16 columns as before — this is the one thing on the old screen that was
  // genuinely complete. Derived, so it can never go stale like the old
  // effect-populated copy did when the trip list emptied.
  const csv = useMemo(() => {
    const rows = visibleTrips.map((trip) => {
      const vehicle = vehicles.find((v) => sameText(v.vehicleNumber, trip.vehicleNumber));
      return {
        'SL Number': trip.slNumber ?? '',
        Date: dateText(trip.date),
        'Vehicle Number': formatVehicleNumber(trip.vehicleNumber),
        'Own Vehicle': vehicle?.isOwn === true ? 'Yes' : 'No',
        'Vehicle Type': trip.vehicleType || 'lorry',
        'STR Number': trip.strNumber || '',
        'STR Status': isStrReceived(trip) ? 'Received' : 'not received',
        Villages: (trip.villages || []).join('; '),
        Quantity: trip.quantity || 0,
        'Driver Name': trip.driverName || '',
        'Mobile Number': trip.mobileNumber || '',
        'Initial Advances Total': trip.initialTotal || 0,
        'Initial Advances Count': trip.initialAdvances.length,
        'Additional Advances Total': trip.additionalTotal || 0,
        'Additional Advances Count': trip.additionalAdvances.length,
        'Grand Total Advances': trip.totalAdvances || 0,
        'Total Advance Records': trip.advanceCount || 0,
        Note: trip.note || ''
      };
    });

    return {
      rows,
      headers: Object.keys(rows[0] || {}).map((key) => ({ label: key, key })),
      filename: `SuhelRoadlines_${iso(win.from)}_to_${iso(win.to)}.csv`
    };
  }, [visibleTrips, vehicles, win]);

  /* ------------------------------------------------------------------ pdf */
  const exportPdf = useCallback(() => {
    if (!csv.rows.length) {
      toast.error('Nothing to export in this period');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    /* Title */
    doc.setFontSize(14);
    doc.text('Suhel Roadlines — Trip Report', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${dateText(win.from)} — ${dateText(win.to)}  ·  ${csv.rows.length} trips`, 14, 21);

    /* Table */
    const head = [csv.headers.map((h) => h.label)];
    const body = csv.rows.map((row) => csv.headers.map((h) => String(row[h.key] ?? '')));

    autoTable(doc, {
      startY: 26,
      head,
      body,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      /* Highlight own-vehicle rows with a brand tint. */
      didParseCell: (data) => {
        if (data.section === 'body') {
          const trip = visibleTrips[data.row.index];
          const vehicle = vehicles.find((v) => sameText(v.vehicleNumber, trip?.vehicleNumber));
          if (vehicle?.isOwn === true) {
            data.cell.styles.fillColor = [219, 234, 254]; /* brand-50 */
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`SuhelRoadlines_${iso(win.from)}_to_${iso(win.to)}.pdf`);
    toast.success(`Exported ${csv.rows.length} trips as PDF`);
  }, [csv, visibleTrips, vehicles, win, toast]);

  const villageOptions = useMemo(() => {
    const byName = new Map();
    for (const village of villages) {
      if (village.villageName) byName.set(village.villageName, village.code || '');
    }
    // A village already on the trip must stay selectable even if it has since
    // been deactivated, or editing the trip would silently drop it.
    for (const name of draft?.villages || []) if (!byName.has(name)) byName.set(name, '');

    return [...byName.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, code]) => ({ value: name, label: name, subtitle: code || undefined }));
  }, [villages, draft]);

  const addVillage = async (raw) => {
    const villageName = normaliseVillageName(raw);
    if (!villageName) return;

    const existing = villages.find((item) => sameText(item.villageName, villageName));
    const canonical = existing?.villageName || villageName;

    setDraft((prev) =>
      prev.villages.some((item) => sameText(item, canonical))
        ? prev
        : { ...prev, villages: [...prev.villages, canonical] }
    );
    if (existing) return;

    try {
      const created = await villageService.addVillage({
        villageName,
        code: suggestVillageCode(
          villageName,
          villages.map((item) => item.code)
        ),
        isActive: true,
        usageCount: 1
      });
      setVillages((prev) => [...prev, created]);
    } catch (error) {
      console.error('Error adding village:', error);
    }
  };

  /* ----------------------------------------------------------------- render */

  if (loading) {
    return (
      <div className="rep">
        <div className="rep__skeleton">
          <Skeleton height={40} radius="var(--r-capsule)" />
          <Skeleton height={188} radius="var(--r-lg)" />
          <Skeleton height={96} radius="var(--r-lg)" />
          <Skeleton height={220} radius="var(--r-lg)" />
        </div>
      </div>
    );
  }

  return (
    <div className="rep">
      {/* 1 — range. Scopes every number below, so nothing above it. */}
      <div className="rep__toolbar">
        {/* The Custom segment only exists once a custom window is in play.
            Segmented has no "nothing selected" state, so without this the pill
            would sit on Day and claim the wrong period. */}
        <Segmented
          options={range === 'custom' ? [...RANGES, { value: 'custom', label: 'Custom' }] : RANGES}
          value={range}
          onChange={setRange}
          ariaLabel="Reporting period"
        />

        <button
          type="button"
          className="rep__range"
          onClick={() => setRangeSheet(true)}
          aria-haspopup="dialog"
          aria-expanded={rangeSheet}
          aria-label={`Period, ${rangeLabel}. Change`}
        >
          <CalendarIcon size={15} />
          <span>{rangeLabel}</span>
          <ChevronDownIcon size={13} className="rep__range-chevron" />
        </button>
      </div>

      {/* 2 — the take-away, in words and one concrete number, with a comparison
             so the number means something on its own. */}
      <Card className="rep__hero">
        <div className="rep__hero-head">
          <span className="rep__hero-label">
            {measureName} · {rangeLabel}
          </span>
          {delta && (
            <Badge tone={delta.up ? 'success' : 'danger'}>
              {delta.up ? '▲' : '▼'} {delta.pct}% vs {win.comparisonLabel}
            </Badge>
          )}
        </div>

        <span className="rep__hero-value">{measureHeadline}</span>

        {/* Doubles as the chart's value readout: selecting a bar replaces the
            summary line rather than floating a tooltip over the bars. */}
        <p className="rep__hero-note" aria-live="polite">
          {totals.trips === 0
            ? 'No trips in this period.'
            : selectedPoint
            ? `${selectedPoint.label}: ${formatMeasure(selectedPoint.value)}`
            : `Across ${totals.trips} ${totals.trips === 1 ? 'trip' : 'trips'} and ${
                totals.vehicles
              } ${totals.vehicles === 1 ? 'vehicle' : 'vehicles'}.`}
        </p>

        {/* 3 — the chart. One measure at a time: three questions on one set of
               axes would answer none of them clearly. */}
        <Segmented
          options={MEASURES}
          value={measure}
          onChange={setMeasure}
          ariaLabel="Measure"
          className="rep__measures"
        />

        {!chartHasData ? (
          <div className="rep__chart-empty">
            <ChartIcon size={22} />
            <span>Nothing to plot in {buckets.caption}</span>
          </div>
        ) : (
          <>
            <BarChart
              points={buckets.points}
              formatValue={formatMeasure}
              formatAxis={formatAxis}
              selectedKey={selectedBar}
              onSelect={(point) => setSelectedBar(point?.key ?? null)}
              ariaLabel={`${measureName} by ${buckets.monthly ? 'month' : 'day'}, ${buckets.caption}`}
              height={170}
            />
            <span className="rep__chart-caption">{buckets.caption}</span>
          </>
        )}
      </Card>

      {/* 4 — secondary magnitudes. Deliberately below the chart: useful, but not
             what the screen is about. */}
      <Card className="rep__stats">
        <Stat value={totals.trips} label="Trips" />
        <span className="rep__stats-divider" aria-hidden="true" />
        <Stat value={Number(totals.quantity.toFixed(2))} label="Quantity" />
        <span className="rep__stats-divider" aria-hidden="true" />
        <Stat value={formatCompactINR(totals.avgPerTrip)} label="Avg / trip" />
        <span className="rep__stats-divider" aria-hidden="true" />
        <Stat
          value={totals.strDue}
          label="STR due"
          tone={totals.strDue ? 'danger' : 'success'}
          dot
        />
      </Card>

      {/* 5 — which vehicles, not how many. A count is a dead end; a ranking is
             something you can act on. */}
      {byVehicle.length > 0 && (
        <section className="rep__block">
          <SectionHeader title={`Top vehicles by ${measureName.toLowerCase()}`} />
          <ListSection inset={false} className="stg26">
            {byVehicle.map((row) => (
              <ListRow
                key={row.vehicleNumber}
                icon={<TruckIcon size={17} />}
                iconTone="brand"
                title={formatVehicleNumber(row.vehicleNumber)}
                subtitle={`${row.trips} ${row.trips === 1 ? 'trip' : 'trips'}`}
                value={formatMeasure(row.value)}
              >
                {/* The bar is redundant with the number on purpose: proportion is
                    read instantly, the exact figure is not. */}
                <span className="rep__vehicle-track" aria-hidden="true">
                  <span className="rep__vehicle-fill" style={{ width: `${row.share}%` }} />
                </span>
              </ListRow>
            ))}
          </ListSection>
        </section>
      )}

      {/* 6 — the records. Rows, not a ten-column table: the old one hid three
             columns below 640px, which is an admission it never fitted. */}
      <section className="rep__block">
        <div className="rep__records-head">
          <Segmented
            options={TABS.map((item) => ({
              ...item,
              count: item.value === 'trips' ? visibleTrips.length : visibleAdvances.length
            }))}
            value={tab}
            onChange={setTab}
            ariaLabel="Records"
          />
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Vehicle, driver, village or SL"
          />
        </div>

        {tab === 'trips' ? (
          visibleTrips.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={<TruckIcon size={26} />}
                title="No trips here"
                message={
                  query
                    ? `Nothing matched “${query.trim()}”.`
                    : 'Try a wider period from the control above.'
                }
                action={
                  query ? (
                    <Button variant="tinted" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <ListSection
              inset={false}
              className="stg26"
              footer="Tap a trip for its full record, or to edit or delete it."
              key={`trips-${range}-${tab}`}
            >
              {visibleTrips.map((trip) => {
                const received = isStrReceived(trip);
                return (
                  <ListRow
                    key={trip.id}
                    thumbnail={
                      (Array.isArray(trip.images) ? trip.images[0] : null) ||
                      trip.imageUrl || undefined
                    }
                    icon={received ? <DocCheckIcon size={17} /> : <DocAlertIcon size={17} />}
                    iconTone={received ? 'success' : 'danger'}
                    title={formatVehicleNumber(trip.vehicleNumber)}
                    subtitle={`#${trip.slNumber ?? '—'} · ${trip.driverName || 'No driver'}`}
                    detail={`${dateText(trip.date)}${
                      trip.villages?.length ? ` · ${trip.villages.join(', ')}` : ''
                    }`}
                    value={formatINR(trip.totalAdvances)}
                    className={isOwnTrip(trip) ? 'lst26__row--own' : ''}
                    chevron
                    onClick={() => setDetailTrip(trip)}
                  />
                );
              })}
            </ListSection>
          )
        ) : visibleAdvances.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon={<WalletIcon size={26} />}
              title="No advances here"
              message="Nothing was advanced in this period."
            />
          </Card>
        ) : (
          <ListSection inset={false} className="stg26" key={`adv-${range}-${tab}`}>
            {visibleAdvances.map((item) => (
              <ListRow
                key={item.id}
                thumbnail={
                  (Array.isArray(item.images) ? item.images[0] : null) ||
                  item.imageUrl || undefined
                }
                icon={<WalletIcon size={17} />}
                iconTone={item.advanceType === 'initial' ? 'accent' : 'brand'}
                title={formatVehicleNumber(item.vehicleNumber) || '—'}
                subtitle={item.advanceType === 'initial' ? 'Opening advance' : 'Top-up'}
                detail={`${dateText(advanceWhen(item))}${item.note ? ` · ${item.note}` : ''}`}
                value={formatINR(item.advanceAmount)}
                className={isOwnTrip(item) ? 'lst26__row--own' : ''}
              />
            ))}
          </ListSection>
        )}
      </section>

      {/* 7 — export. Terminal action, so it closes the screen rather than
             sitting in a filter card at the top as it used to. */}
      <ListSection inset={false} className="rep__export">
        <ListRow
          as="div"
          icon={<TrendUpIcon size={17} />}
          iconTone="accent"
          title={
            <CSVLink
              data={csv.rows}
              headers={csv.headers}
              filename={csv.filename}
              className="rep__export-link"
              onClick={() => {
                if (!csv.rows.length) {
                  toast.error('Nothing to export in this period');
                  return false;
                }
                toast.success(`Exported ${csv.rows.length} trips`);
                return true;
              }}
            >
              Export {csv.rows.length} {csv.rows.length === 1 ? 'trip' : 'trips'} as CSV
            </CSVLink>
          }
        />
        <ListRow
          as="div"
          icon={<TrendUpIcon size={17} />}
          iconTone="brand"
          title={
            <button
              type="button"
              className="rep__export-link"
              onClick={exportPdf}
            >
              Export {csv.rows.length} {csv.rows.length === 1 ? 'trip' : 'trips'} as PDF
            </button>
          }
        />
      </ListSection>

      {/* ------------------------------- overlays ------------------------------- */}

      <Sheet
        open={rangeSheet}
        onClose={() => setRangeSheet(false)}
        title="Custom period"
        primaryAction={
          <Button variant="plain" onClick={() => setRangeSheet(false)}>
            Done
          </Button>
        }
        secondaryAction={
          <Button
            variant="plain"
            onClick={() => {
              setRange('month');
              setRangeSheet(false);
            }}
          >
            Reset
          </Button>
        }
      >
        <ListSection inset={false} footer="Choosing dates here switches the period to Custom.">
          <ListRow>
            <DateField
              label="From"
              layout="row"
              value={custom.from}
              onChange={(event) => {
                setCustom((prev) => ({ ...prev, from: event.target.value }));
                setRange('custom');
              }}
            />
          </ListRow>
          <ListRow>
            <DateField
              label="To"
              layout="row"
              value={custom.to}
              onChange={(event) => {
                setCustom((prev) => ({ ...prev, to: event.target.value }));
                setRange('custom');
              }}
            />
          </ListRow>
        </ListSection>
      </Sheet>

      {/* Trip detail. Everything the old table crammed into ten columns, at a
          size you can actually read, with the two actions at the bottom. */}
      <Sheet
        open={Boolean(detailTrip) && !draft}
        onClose={() => setDetailTrip(null)}
        title={formatVehicleNumber(detailTrip?.vehicleNumber) || 'Trip'}
        subtitle={detailTrip ? `#${detailTrip.slNumber ?? '—'} · ${dateText(detailTrip.date)}` : ''}
        detent="large"
        primaryAction={
          <Button variant="plain" onClick={() => openEdit(detailTrip)}>
            Edit
          </Button>
        }
      >
        {detailTrip && (
          <>
            <Card className="rep__detail-hero">
              <span className="rep__detail-label">Total advance</span>
              <span className="rep__detail-value">{formatINR(detailTrip.totalAdvances)}</span>
              <Badge tone={isStrReceived(detailTrip) ? 'success' : 'danger'} dot>
                {isStrReceived(detailTrip) ? 'STR received' : 'STR due'}
              </Badge>
            </Card>

            {(() => {
              const photos = Array.isArray(detailTrip.images) && detailTrip.images.length
                ? detailTrip.images
                : detailTrip.imageUrl ? [detailTrip.imageUrl] : [];
              return photos.length > 0 ? (
                <div className="rep__detail-photos">
                  {photos.map((url, i) => (
                    <div key={`${url}-${i}`} className="rep__detail-photo-tile">
                      <img src={url} alt="" loading="lazy" />
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            <ListSection inset={false} header="Trip">
              <ListRow title="Date" value={dateText(detailTrip.date)} />
              <ListRow title="Vehicle" value={formatVehicleNumber(detailTrip.vehicleNumber) || '—'} />
              <ListRow title="Type" value={detailTrip.vehicleType || 'lorry'} />
              <ListRow title="Quantity" value={String(detailTrip.quantity ?? '—')} />
              <ListRow title="Villages" value={(detailTrip.villages || []).join(', ') || '—'} />
            </ListSection>

            <ListSection inset={false} header="Driver">
              <ListRow title="Name" value={detailTrip.driverName || '—'} />
              <ListRow title="Mobile" value={detailTrip.mobileNumber || '—'} />
            </ListSection>

            {detailTrip.note && (
              <ListSection inset={false} header="Note">
                <ListRow title={detailTrip.note} />
              </ListSection>
            )}

            <ListSection
              inset={false}
              header="Advances"
              footer={`${detailTrip.advanceCount} ${
                detailTrip.advanceCount === 1 ? 'record' : 'records'
              } in total.`}
            >
              <ListRow
                title="Opening"
                subtitle={`${detailTrip.initialAdvances.length} ${
                  detailTrip.initialAdvances.length === 1 ? 'record' : 'records'
                }`}
                value={formatINR(detailTrip.initialTotal)}
              />
              <ListRow
                title="Top-ups"
                subtitle={`${detailTrip.additionalAdvances.length} ${
                  detailTrip.additionalAdvances.length === 1 ? 'record' : 'records'
                }`}
                value={formatINR(detailTrip.additionalTotal)}
              />
            </ListSection>

            <ListSection inset={false}>
              <ListRow
                title="Delete trip"
                destructive
                onClick={() => setPendingDelete(detailTrip)}
              />
            </ListSection>
          </>
        )}
      </Sheet>

      {/* Edit. A sheet carries its own Save, because the nav bar is behind it. */}
      <Sheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="Edit trip"
        detent="large"
        secondaryAction={
          <Button variant="plain" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        }
        primaryAction={
          <Button variant="plain" loading={saving} onClick={saveEdit}>
            Save
          </Button>
        }
      >
        {draft && (
          <>
            <ListSection
              inset={false}
              header="Trip"
              footer={errors.vehicleNumber || errors.date || errors.villages}
            >
              <ListRow>
                <NumberField
                  label="SL"
                  layout="row"
                  value={draft.slNumber}
                  onChange={(event) => setDraft((prev) => ({ ...prev, slNumber: event.target.value }))}
                />
              </ListRow>
              <ListRow>
                <DateField
                  label="Date"
                  layout="row"
                  value={draft.date}
                  error={errors.date}
                  onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
                />
              </ListRow>
              <ListRow>
                <TextField
                  label="Vehicle"
                  layout="row"
                  className="fld__input--uppercase"
                  value={draft.vehicleNumber}
                  error={errors.vehicleNumber}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      vehicleNumber: normaliseVehicleNumber(event.target.value)
                    }))
                  }
                />
              </ListRow>
              <ListRow>
                <Picker
                  label="Type"
                  layout="row"
                  value={draft.vehicleType}
                  options={TYPE_OPTIONS}
                  onChange={(value) => setDraft((prev) => ({ ...prev, vehicleType: value }))}
                />
              </ListRow>
              <ListRow>
                <Picker
                  label="STR"
                  layout="row"
                  value={draft.strStatus}
                  options={STR_OPTIONS}
                  onChange={(value) => setDraft((prev) => ({ ...prev, strStatus: value }))}
                />
              </ListRow>
              <ListRow>
                {/* Multi-select with create, so villages can be added back. The
                    old modal could only remove them, and validation then
                    refused to submit with none left. */}
                <Picker
                  label="Villages"
                  layout="row"
                  multiple
                  searchable
                  value={draft.villages}
                  options={villageOptions}
                  onChange={(value) => setDraft((prev) => ({ ...prev, villages: value }))}
                  onCreate={addVillage}
                  createLabel="Add"
                  error={errors.villages}
                />
              </ListRow>
              <ListRow>
                <NumberField
                  label="Quantity"
                  layout="row"
                  value={draft.quantity}
                  error={errors.quantity}
                  onChange={(event) => setDraft((prev) => ({ ...prev, quantity: event.target.value }))}
                />
              </ListRow>
            </ListSection>

            {/* Hint only: the mobile error is rendered by the field itself, and
                printing it here as well showed the same message twice. */}
            <ListSection inset={false} header="Driver" footer="Both are optional.">
              <ListRow>
                <TextField
                  label="Name"
                  layout="row"
                  value={draft.driverName}
                  placeholder="Optional"
                  onChange={(event) => setDraft((prev) => ({ ...prev, driverName: event.target.value }))}
                />
              </ListRow>
              <ListRow>
                <PhoneField
                  label="Mobile"
                  layout="row"
                  value={draft.mobileNumber}
                  error={errors.mobileNumber}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, mobileNumber: event.target.value }))
                  }
                />
              </ListRow>
            </ListSection>

            <ListSection inset={false} header="Note" footer="Optional — any remark about this trip.">
              <ListRow>
                <TextArea
                  label="Note"
                  value={draft.note}
                  placeholder="Optional"
                  onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                  rows={3}
                />
              </ListRow>
            </ListSection>

            <ListSection inset={false} header="Photos" footer="Optional — a delivery challan, lorry photo, or anything relevant.">
              <ListRow>
                <ImagePicker
                  value={draft.images}
                  onChange={(images) => setDraft((prev) => ({ ...prev, images }))}
                  disabled={saving}
                />
              </ListRow>
            </ListSection>

            <ListSection
              footer={
                errors.advanceAmount ||
                'Raising this records a top-up for the difference. Lowering it does not remove one.'
              }
            >
              <ListRow>
                <CurrencyField
                  label="Opening advance"
                  layout="row"
                  value={draft.advanceAmount}
                  error={errors.advanceAmount}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, advanceAmount: event.target.value }))
                  }
                />
              </ListRow>
            </ListSection>
          </>
        )}
      </Sheet>

      <Alert
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this trip?"
        message={`Trip #${pendingDelete?.slNumber ?? ''} for ${formatVehicleNumber(
          pendingDelete?.vehicleNumber
        )} will be removed. Its advance records stay on file. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default ReportsPage;
