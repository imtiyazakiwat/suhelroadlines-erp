/* =============================================================================
   fleetService — everything the app knows about one vehicle, assembled once.

   Why a service rather than memos on the screen: the vehicle file is a join
   across all four collections (trips, advances, vehicles, villages), and the
   list screen needs the same join for every own vehicle. Doing it here means one
   definition of "this lorry's totals", and it keeps the two screens to rendering.

   Cost: four cache-backed reads per mount, then a single indexing pass —
   O(T + A + V) — after which each vehicle only walks its own records. The naive
   version, filtering the full trip and advance lists once per vehicle, is
   O(V × (T + A)); with a real book of a few thousand trips that is the
   difference between instant and noticeable.

   Advance totals come from `joinTripAdvances` in homeService, the same function
   Reports uses. Deriving them here independently is exactly how the old Reports
   page ended up showing two different figures for the same trip.
   ========================================================================== */

import { tripService, vehicleService, advanceService, villageService } from './firebaseService';
import { joinTripAdvances, advanceWhen, toDate, isStrReceived } from './homeService';
import { tidy, formatVehicleNumber } from './textService';

/**
 * Canonical match key for a vehicle number.
 *
 * Trips store the number as a string while the vehicle document is *keyed* by
 * it, and records written before input normalisation existed can differ in case
 * and spacing. Matching on a folded key is what stops a lorry's own trips going
 * missing from its file.
 */
const keyOf = (value) => tidy(value).toUpperCase();

const nameKey = (value) => tidy(value).toLowerCase();

const push = (map, key, item) => {
  const bucket = map.get(key);
  if (bucket) bucket.push(item);
  else map.set(key, [item]);
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);

const sum = (list, pick) => list.reduce((total, item) => total + (Number(pick(item)) || 0), 0);

const newestFirst = (pick) => (a, b) =>
  (toDate(pick(b))?.getTime() || 0) - (toDate(pick(a))?.getTime() || 0);

/* ------------------------------------------------------------------- reads */

const readAll = async () => {
  const [trips, advances, vehicles, villages] = await Promise.all([
    tripService.getAllTrips(),
    advanceService.getAllAdvances(),
    // Inactive included: a lorry you have parked is still one of yours, and its
    // history is the main reason to open its file.
    vehicleService.getAllVehicles(true),
    villageService.getAllVillages(true).catch(() => [])
  ]);

  return {
    trips: trips || [],
    advances: advances || [],
    vehicles: vehicles || [],
    villages: villages || []
  };
};

/* ----------------------------------------------------------------- indexing */

const index = ({ trips, advances, villages }) => {
  const joined = joinTripAdvances(trips, advances);

  const tripsByVehicle = new Map();
  const vehicleKeyByTripId = new Map();

  for (const trip of joined.trips) {
    const key = keyOf(trip.vehicleNumber);
    if (trip.id) vehicleKeyByTripId.set(trip.id, key);
    push(tripsByVehicle, key, trip);
  }

  const advancesByVehicle = new Map();

  for (const advance of joined.advances) {
    /* The trip wins over the advance's own `vehicleNumber`. They can disagree —
       editing a trip's vehicle in Reports does not rewrite the advances already
       logged against it — and attributing the money to the trip's vehicle is what
       keeps a trip's total and its vehicle's total adding up to each other. An
       advance with no trip falls back to its own number, so orphans are still
       counted somewhere rather than silently dropped. */
    const key =
      (advance.tripId && vehicleKeyByTripId.get(advance.tripId)) || keyOf(advance.vehicleNumber);
    if (!key) continue;
    push(advancesByVehicle, key, advance);
  }

  const codeByVillage = new Map();
  for (const village of villages) {
    if (village?.villageName) codeByVillage.set(nameKey(village.villageName), village.code || '');
  }

  return { tripsByVehicle, advancesByVehicle, codeByVillage };
};

/* ------------------------------------------------------------------- build */

const buildFile = (vehicle, { tripsByVehicle, advancesByVehicle, codeByVillage }) => {
  const key = keyOf(vehicle.vehicleNumber);
  const now = new Date();

  const trips = [...(tripsByVehicle.get(key) || [])].sort(newestFirst((trip) => trip.date));
  const advances = [...(advancesByVehicle.get(key) || [])].sort(newestFirst(advanceWhen));

  /* Opening advances against everything else, and the two add up to the total by
     construction. Reports' finer split (which requires a tripId to count as a
     top-up) leaves an orphaned, untyped advance in neither bucket — fine for a
     period report, wrong for a ledger that has to balance.

     There is deliberately no "unsettled" figure here even though every advance
     carries `isSettled`. Nothing in the app can settle one, so the number would
     always equal the total: a metric that looks like information and is not. */
  const opening = advances.filter((item) => item.advanceType === 'initial');
  const topUps = advances.filter((item) => item.advanceType !== 'initial');

  const advanceTotal = sum(advances, (item) => item.advanceAmount);

  const strReceived = trips.filter(isStrReceived);
  const strDue = trips.filter((trip) => !isStrReceived(trip));

  const dates = trips.map((trip) => toDate(trip.date)).filter(Boolean);
  const lastTrip = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  const firstTrip = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;

  const monthTrips = dates.filter(
    (date) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  ).length;

  // Ranked, not counted: "which villages does this lorry actually run to" is
  // something you can act on; "12 villages" is not.
  const routeTally = new Map();
  for (const trip of trips) {
    for (const village of trip.villages || []) {
      const id = nameKey(village);
      if (!id) continue;
      const entry = routeTally.get(id) || {
        villageName: village,
        code: codeByVillage.get(id) || '',
        trips: 0
      };
      entry.trips += 1;
      routeTally.set(id, entry);
    }
  }

  const routes = [...routeTally.values()].sort(
    (a, b) => b.trips - a.trips || a.villageName.localeCompare(b.villageName)
  );

  return {
    // The raw number stays the identity, because it is the document key. The
    // formatted one is for display only.
    key,
    vehicle,
    displayNumber: formatVehicleNumber(vehicle.vehicleNumber),
    isOwn: vehicle.isOwn === true,
    isActive: vehicle.isActive !== false,

    metrics: {
      trips: trips.length,
      monthTrips,
      quantity: sum(trips, (trip) => trip.quantity),
      advanceTotal,
      openingTotal: sum(opening, (item) => item.advanceAmount),
      openingCount: opening.length,
      topUpTotal: sum(topUps, (item) => item.advanceAmount),
      topUpCount: topUps.length,
      advanceCount: advances.length,
      // Per completed trip, so it is comparable between lorries of different ages.
      advancePerTrip: trips.length ? Math.round(advanceTotal / trips.length) : 0,
      strDue: strDue.length,
      strReceived: strReceived.length,
      strDueAmount: sum(strDue, (trip) => trip.totalAdvances),
      firstTrip,
      lastTrip,
      // null, not 0, when the lorry has never run: "0 days since the last trip"
      // would claim it ran today.
      idleDays: lastTrip ? daysBetween(now, lastTrip) : null,
      onTripToday: Boolean(lastTrip && daysBetween(now, lastTrip) === 0)
    },

    routes,
    trips,
    advances,
    dueTrips: strDue
  };
};

/* ------------------------------------------------------------------ public */

export const fleetService = {
  /**
   * The own fleet, each vehicle with its rollup, most recently used first —
   * which answers "what is moving" without a tap. Vehicles that have never run
   * sort last rather than first, where a null date would otherwise put them.
   */
  async getMyFleet() {
    const data = await readAll();
    const indexes = index(data);

    const own = data.vehicles.filter((vehicle) => vehicle.isOwn === true);
    const files = own
      .map((vehicle) => buildFile(vehicle, indexes))
      .sort((a, b) => {
        const left = a.metrics.lastTrip?.getTime() || 0;
        const right = b.metrics.lastTrip?.getTime() || 0;
        if (left !== right) return right - left;
        return a.displayNumber.localeCompare(b.displayNumber);
      });

    return {
      vehicles: files,
      // Counted here so the empty state can say "none of your 4 vehicles is
      // marked as yours" instead of pretending there are no vehicles at all.
      totalVehicles: data.vehicles.length,
      totals: {
        vehicles: files.length,
        active: files.filter((file) => file.isActive).length,
        trips: sum(files, (file) => file.metrics.trips),
        advanceTotal: sum(files, (file) => file.metrics.advanceTotal),
        quantity: sum(files, (file) => file.metrics.quantity),
        strDue: sum(files, (file) => file.metrics.strDue),
        onTripToday: files.filter((file) => file.metrics.onTripToday).length
      }
    };
  },

  /**
   * One vehicle's complete file. Looked up across every vehicle, not just the own
   * fleet, so a deep link or a bookmark still resolves after the ownership flag
   * is turned off — the screen says whether it is yours rather than 404ing.
   *
   * Returns null when there is no such vehicle.
   */
  async getVehicleFile(vehicleNumber) {
    const wanted = keyOf(vehicleNumber);
    if (!wanted) return null;

    const data = await readAll();
    const vehicle = data.vehicles.find((item) => keyOf(item.vehicleNumber) === wanted);
    if (!vehicle) return null;

    return buildFile(vehicle, index(data));
  }
};

export default fleetService;
