import { tripService, vehicleService, advanceService } from './firebaseService';
import { formatVehicleNumber } from './textService';

/** Firestore Timestamp | Date | string -> Date | null */
export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (e) {
      return null;
    }
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (d) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);

/** A trip counts as "STR paid/received" only for the explicit received value. */
export const isStrReceived = (trip) => {
  const raw = String(trip.strStatus || trip.strNumber || '').trim().toLowerCase();
  return raw === 'received';
};

/** "Today" / "Yesterday" / "12 Aug" — the relative label used on reminder rows. */
export const relativeDayLabel = (value) => {
  const date = toDate(value);
  if (!date) return '—';
  const diff = daysBetween(new Date(), date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** 349 -> "₹349", 250000 -> "₹2.5L", 15000000 -> "₹1.5Cr" */
export const formatCompactINR = (amount) => {
  const value = Number(amount) || 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const trim = (n) => String(Number(n.toFixed(1))).replace(/\.0$/, '');

  if (abs >= 10000000) return `${sign}₹${trim(abs / 10000000)}Cr`;
  if (abs >= 100000) return `${sign}₹${trim(abs / 100000)}L`;
  if (abs >= 1000) return `${sign}₹${trim(abs / 1000)}K`;
  return `${sign}₹${Math.round(abs)}`;
};

/** 2500 -> "₹2,500" */
export const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);

/**
 * Join the advance ledger onto trips.
 *
 * Lifted out of ReportsPage so there is exactly one definition of "what this
 * trip was advanced". The old Reports page had two — the row rendered
 * `advanceAmount` while the summary and the CSV used `totalAdvances` — and they
 * disagreed on screen. Any new screen that needs the figure imports this rather
 * than adding a third.
 *
 * The synthetic "initial advance" stands in for trips whose opening advance was
 * recorded on the trip itself rather than as its own document, so those trips
 * still appear in the ledger instead of quietly holding money nobody can see.
 *
 * @returns {{trips: object[], advances: object[]}} enriched trips, and every
 *   advance record including the stand-ins.
 */
export const joinTripAdvances = (trips = [], advances = []) => {
  const byTrip = new Map();
  for (const advance of advances) {
    if (!advance.tripId) continue;
    const bucket = byTrip.get(advance.tripId);
    if (bucket) bucket.push(advance);
    else byTrip.set(advance.tripId, [advance]);
  }

  const synthetic = [];

  const enriched = trips.map((trip) => {
    const own = byTrip.get(trip.id) || [];

    let initialList = own.filter((item) => item.advanceType === 'initial');
    const additionalList = own.filter(
      (item) => item.advanceType === 'additional' || (!item.advanceType && item.tripId)
    );

    const sum = (list) => list.reduce((total, item) => total + (Number(item.advanceAmount) || 0), 0);
    let initialTotal = sum(initialList);
    const additionalTotal = sum(additionalList);

    if (Number(trip.advanceAmount) > 0 && initialTotal === 0) {
      const standIn = {
        id: `trip-${trip.id}`,
        tripId: trip.id,
        vehicleNumber: trip.vehicleNumber,
        tripDate: trip.date,
        advanceAmount: Number(trip.advanceAmount) || 0,
        advanceType: 'initial',
        note: 'Opening advance recorded on the trip',
        createdAt: trip.createdAt || trip.date,
        synthetic: true
      };
      initialList = [standIn];
      initialTotal = standIn.advanceAmount;
      synthetic.push(standIn);
    }

    return {
      ...trip,
      initialAdvances: initialList,
      additionalAdvances: additionalList,
      initialTotal,
      additionalTotal,
      totalAdvances: initialTotal + additionalTotal,
      // Every record counted exactly once. The old version added the initial
      // list length on top of a count that already included it.
      advanceCount: initialList.length + additionalList.length
    };
  });

  return { trips: enriched, advances: [...advances, ...synthetic] };
};

/** An advance belongs to the period it was advanced *for*, not when it was typed. */
export const advanceWhen = (advance) => advance?.tripDate || advance?.createdAt;

const EMPTY = {
  todayTrips: 0,
  advanceToday: 0,
  paidStrCount: 0,
  dueStrCount: 0,
  vehicles: { total: 0, active: 0, inTransit: 0, inactive: 0 },
  reminders: [],
  totalSettlement: 0,
  avgAdvancePerTrip: 0,
  month: { label: '', advance: 0, trips: 0, deltaPct: null, series: [] }
};

const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/**
 * Everything the home screen needs, in one pass over trips / vehicles / advances.
 * Individual failures degrade to zeros rather than blanking the screen.
 */
export const homeService = {
  async getHomeSummary() {
    const [tripsResult, vehiclesResult, advancesResult] = await Promise.allSettled([
      tripService.getAllTrips(),
      vehicleService.getAllVehicles(),
      advanceService.getAllAdvances()
    ]);

    const trips = tripsResult.status === 'fulfilled' && Array.isArray(tripsResult.value) ? tripsResult.value : [];
    const vehicles =
      vehiclesResult.status === 'fulfilled' && Array.isArray(vehiclesResult.value) ? vehiclesResult.value : [];
    const advances =
      advancesResult.status === 'fulfilled' && Array.isArray(advancesResult.value) ? advancesResult.value : [];

    if (!trips.length && !vehicles.length && !advances.length) {
      return { ...EMPTY, vehicles: { ...EMPTY.vehicles } };
    }

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ---- trips -------------------------------------------------------------
    let todayTrips = 0;
    let monthTrips = 0;
    let paidStrCount = 0;
    const dueTrips = [];
    const vehiclesOnTripToday = new Set();
    const lastTripByVehicle = new Map();

    trips.forEach((trip) => {
      const date = toDate(trip.date) || toDate(trip.createdAt);
      const dayDiff = date ? daysBetween(now, date) : null;

      if (dayDiff === 0) {
        todayTrips += 1;
        if (trip.vehicleNumber) vehiclesOnTripToday.add(trip.vehicleNumber);
      }

      if (date && sameMonth(date, now)) monthTrips += 1;

      if (trip.vehicleNumber && date) {
        const previous = lastTripByVehicle.get(trip.vehicleNumber);
        if (!previous || date > previous) lastTripByVehicle.set(trip.vehicleNumber, date);
      }

      if (isStrReceived(trip)) {
        paidStrCount += 1;
      } else {
        dueTrips.push({ ...trip, _date: date });
      }
    });

    // ---- advances ----------------------------------------------------------
    let totalSettlement = 0;
    let advanceToday = 0;
    let monthAdvance = 0;
    let previousMonthAdvance = 0;
    const advanceByTrip = new Map();
    // Trailing 7 days, oldest first, for the sparkline on the month card.
    const trailing = new Array(7).fill(0);

    advances.forEach((advance) => {
      const amount = Number(advance.advanceAmount) || 0;
      totalSettlement += amount;

      // Same rule Reports uses: an advance belongs to the period it was advanced
      // *for*, falling back to when it was recorded.
      const when = toDate(advance.tripDate) || toDate(advance.createdAt);
      if (when) {
        const diff = daysBetween(now, when);
        if (diff === 0) advanceToday += amount;
        if (diff >= 0 && diff <= 6) trailing[6 - diff] += amount;
        if (sameMonth(when, now)) monthAdvance += amount;
        else if (sameMonth(when, previousMonth)) previousMonthAdvance += amount;
      }

      if (advance.tripId) {
        advanceByTrip.set(advance.tripId, (advanceByTrip.get(advance.tripId) || 0) + amount);
      }
    });

    // ---- vehicle status breakdown -----------------------------------------
    const inTransit = vehicles.filter((v) => vehiclesOnTripToday.has(v.vehicleNumber)).length;
    const dormant = vehicles.filter((v) => {
      if (v.isActive === false) return true;
      if (vehiclesOnTripToday.has(v.vehicleNumber)) return false;
      const last = lastTripByVehicle.get(v.vehicleNumber);
      return !last || daysBetween(now, last) > 30;
    }).length;

    // ---- reminders: newest unreceived STRs --------------------------------
    const reminders = dueTrips
      .sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0))
      .slice(0, 3)
      .map((trip) => ({
        id: trip.id,
        title: trip.driverName || formatVehicleNumber(trip.vehicleNumber) || 'Unknown driver',
        vehicleNumber: formatVehicleNumber(trip.vehicleNumber),
        amount: advanceByTrip.get(trip.id) ?? (Number(trip.advanceAmount) || 0),
        dayLabel: relativeDayLabel(trip._date)
      }));

    const advanceTripCount = advanceByTrip.size || trips.length;

    return {
      todayTrips,
      advanceToday,
      paidStrCount,
      dueStrCount: dueTrips.length,
      vehicles: {
        total: vehicles.length,
        active: Math.max(vehicles.length - inTransit - dormant, 0),
        inTransit,
        inactive: dormant
      },
      reminders,
      totalSettlement,
      avgAdvancePerTrip: advanceTripCount ? Math.round(totalSettlement / advanceTripCount) : 0,
      month: {
        label: now.toLocaleDateString('en-IN', { month: 'long' }),
        advance: monthAdvance,
        trips: monthTrips,
        // Null rather than 0 when there is no baseline: "0% vs last month" would
        // claim a comparison that was never made.
        deltaPct: previousMonthAdvance
          ? Math.round(((monthAdvance - previousMonthAdvance) / previousMonthAdvance) * 100)
          : null,
        series: trailing.map((value, index) => ({
          key: `d${index}`,
          value,
          label: relativeDayLabel(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index)))
        }))
      }
    };
  }
};

export default homeService;
