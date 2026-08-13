import { 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseAvailable } from '../firebase/config';
import fastSync from './fastSync';
import {
  localTripService,
  localVehicleService,
  localAdvanceService,
  initializeSampleData
} from './localStorageService';

// Initialize sample data if Firebase is not available (only once)
let sampleDataInitialized = false;
if (!isFirebaseAvailable && !sampleDataInitialized) {
  console.warn('Firebase not available, initializing local storage with sample data');
  initializeSampleData();
  sampleDataInitialized = true;
}


// Check if Firebase is available before operations
const checkFirebaseAvailability = () => {
  if (!isFirebaseAvailable || !db) {
    console.warn('Firebase not available, using local storage fallback');
    return false;
  }
  return true;
};

// Collections
const COLLECTIONS = {
  TRIPS: 'trips',
  VEHICLES: 'vehicles',
  ADVANCES: 'advances',
  TRIP_ADVANCES: 'tripAdvances',
  VILLAGES: 'villages',
  APP_SETTINGS: 'appSettings'
};

export { COLLECTIONS };

/* ------------------------------------------------------------------------- */
/* fastSync helpers: Realtime DB cache in front of Firestore.                */
/* Reads come back from cache immediately and revalidate in the background;  */
/* writes land in the cache first and are promoted to Firestore after.       */
/* ------------------------------------------------------------------------- */

/** Firestore Timestamp | ISO string | Date -> Date | null */
const asDate = (value) => {
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

/** Reserve a Firestore document id client-side so we can cache before writing. */
const newId = (collectionName) => doc(collection(db, collectionName)).id;

const byDateDesc = (a, b) => (asDate(b.date)?.getTime() || 0) - (asDate(a.date)?.getTime() || 0);

// Retry handlers for records stranded in the RTDB outbox (write happened,
// Firestore promotion did not). Runs once per app start.
const outboxPromoters = {
  [COLLECTIONS.TRIPS]: (id, entry) =>
    entry.op === 'delete'
      ? deleteDoc(doc(db, COLLECTIONS.TRIPS, id))
      : setDoc(doc(db, COLLECTIONS.TRIPS, id), entry.data, { merge: true }),
  [COLLECTIONS.VEHICLES]: (id, entry) =>
    setDoc(doc(db, COLLECTIONS.VEHICLES, id), entry.data, { merge: true }),
  [COLLECTIONS.ADVANCES]: (id, entry) =>
    setDoc(doc(db, COLLECTIONS.ADVANCES, id), entry.data, { merge: true }),
  [COLLECTIONS.VILLAGES]: (id, entry) =>
    setDoc(doc(db, COLLECTIONS.VILLAGES, id), entry.data, { merge: true })
};

if (isFirebaseAvailable && db) {
  // Deferred so it never competes with first paint.
  setTimeout(() => {
    fastSync
      .flushOutbox(outboxPromoters)
      .then(({ flushed, failed }) => {
        if (flushed || failed) console.log(`fastSync outbox: ${flushed} promoted, ${failed} pending`);
      })
      .catch(() => {});
  }, 1500);
}

// Trip Services
export const tripService = {
  // Add new trip
  async addTrip(tripData) {
    try {
      // Import validation constants
      const { VEHICLE_TYPES, STR_STATUS_VALUES } = await import('../types');
      
      // Validate vehicleType
      const vehicleType = tripData.vehicleType || 'lorry'; // Default to 'lorry'
      if (!VEHICLE_TYPES.includes(vehicleType)) {
        throw new Error(`Invalid vehicleType: ${vehicleType}. Must be one of: ${VEHICLE_TYPES.join(', ')}`);
      }
      
      // Validate strStatus
      const strStatus = tripData.strStatus || 'not received'; // Default to 'not received'
      if (!STR_STATUS_VALUES.includes(strStatus)) {
        throw new Error(`Invalid strStatus: ${strStatus}. Must be one of: ${STR_STATUS_VALUES.join(', ')}`);
      }
      
      // Reserve the id up front so the record can be cached before Firestore
      // acknowledges. Resolves in RTDB time (well under 300 ms).
      const tripId = newId(COLLECTIONS.TRIPS);
      const record = {
        ...tripData,
        vehicleType,
        strStatus,
        createdAt: tripData.createdAt || new Date(),
        updatedAt: new Date()
      };

      await fastSync.writeRecord(COLLECTIONS.TRIPS, tripId, record, () =>
        setDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
          ...record,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );

      const tripWithId = { ...record, id: tripId };

      // If trip has initial advance amount, create an initial advance record
      if (tripData.advanceAmount && tripData.advanceAmount > 0) {
        try {
          const advanceId = newId(COLLECTIONS.ADVANCES);
          const initialAdvanceData = {
            vehicleNumber: tripData.vehicleNumber,
            tripId,
            tripDate: tripData.date,
            advanceAmount: tripData.advanceAmount,
            advanceType: 'initial',
            note: 'Initial advance amount set during trip creation',
            isSettled: false,
            createdAt: new Date()
          };

          await fastSync.writeRecord(COLLECTIONS.ADVANCES, advanceId, initialAdvanceData, () =>
            setDoc(doc(db, COLLECTIONS.ADVANCES, advanceId), {
              ...initialAdvanceData,
              createdAt: serverTimestamp()
            })
          );
        } catch (advanceError) {
          console.error('Error creating initial advance record:', advanceError);
          // Don't fail the trip creation if advance record fails
        }
      }

      return tripWithId;
    } catch (error) {
      console.error('Error adding trip:', error);
      throw error;
    }
  },

  // Get all trips (cache-first, revalidated in the background)
  async getAllTrips() {
    if (!checkFirebaseAvailability()) {
      return await localTripService.getAllTrips();
    }

    return fastSync.readCollection(COLLECTIONS.TRIPS, async () => {
      const querySnapshot = await getDocs(
        query(collection(db, COLLECTIONS.TRIPS), orderBy('createdAt', 'desc'))
      );
      return querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    });
  },

  // Get trips by date range — filtered off the cached list, no round trip
  async getTripsByDateRange(startDate, endDate) {
    const trips = await this.getAllTrips();
    const from = asDate(startDate)?.getTime() ?? -Infinity;
    const to = asDate(endDate)?.getTime() ?? Infinity;

    return trips
      .filter(trip => {
        const when = asDate(trip.date)?.getTime();
        return when !== undefined && when !== null && when >= from && when <= to;
      })
      .sort(byDateDesc);
  },

  // Get trips by vehicle
  async getTripsByVehicle(vehicleNumber) {
    if (!checkFirebaseAvailability()) {
      return await localTripService.getTripsByVehicle(vehicleNumber);
    }
    
    try {
      // Simplified query to avoid composite index requirements
      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TRIPS),
          where('vehicleNumber', '==', vehicleNumber)
        )
      );
      
      const trips = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      
      // Sort client-side by createdAt descending
      return trips.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.warn('Firebase getTripsByVehicle failed, falling back to local storage');
      return await localTripService.getTripsByVehicle(vehicleNumber);
    }
  },

  // Update trip
  async updateTrip(tripId, updateData) {
    try {
      // Import validation constants
      const { VEHICLE_TYPES, STR_STATUS_VALUES } = await import('../types');
      
      // Validate vehicleType if provided
      let finalUpdateData = { ...updateData };
      if (updateData.vehicleType !== undefined) {
        if (!VEHICLE_TYPES.includes(updateData.vehicleType)) {
          throw new Error(`Invalid vehicleType: ${updateData.vehicleType}. Must be one of: ${VEHICLE_TYPES.join(', ')}`);
        }
        finalUpdateData.vehicleType = updateData.vehicleType;
      }
      
      // Validate strStatus if provided
      if (updateData.strStatus !== undefined) {
        if (!STR_STATUS_VALUES.includes(updateData.strStatus)) {
          throw new Error(`Invalid strStatus: ${updateData.strStatus}. Must be one of: ${STR_STATUS_VALUES.join(', ')}`);
        }
        finalUpdateData.strStatus = updateData.strStatus;
      }
      
      await fastSync.writeRecord(
        COLLECTIONS.TRIPS,
        tripId,
        { ...finalUpdateData, updatedAt: new Date() },
        () =>
          updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
            ...finalUpdateData,
            updatedAt: serverTimestamp()
          }),
        { op: 'update' }
      );

      return { id: tripId, ...finalUpdateData };
    } catch (error) {
      console.error('Error updating trip:', error);
      throw error;
    }
  },

  // Delete trip
  async deleteTrip(tripId) {
    try {
      await fastSync.removeRecord(COLLECTIONS.TRIPS, tripId, () =>
        deleteDoc(doc(db, COLLECTIONS.TRIPS, tripId))
      );
      return tripId;
    } catch (error) {
      console.error('Error deleting trip:', error);
      throw error;
    }
  },

  // Get next SL number
  async getNextSlNumber() {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, COLLECTIONS.TRIPS), orderBy('slNumber', 'desc'), limit(1))
      );
      
      if (querySnapshot.empty) {
        return 1;
      }
      
      const lastTrip = querySnapshot.docs[0].data();
      return (lastTrip.slNumber || 0) + 1;
    } catch (error) {
      console.error('Error getting next SL number:', error);
      return 1;
    }
  },

  // Update STR status only
  async updateSTRStatus(tripId, strStatus) {
    try {
      // Import validation constants
      const { STR_STATUS_VALUES } = await import('../types');
      
      // Validate strStatus
      if (!STR_STATUS_VALUES.includes(strStatus)) {
        throw new Error(`Invalid strStatus: ${strStatus}. Must be one of: ${STR_STATUS_VALUES.join(', ')}`);
      }
      
      await fastSync.writeRecord(
        COLLECTIONS.TRIPS,
        tripId,
        { strStatus, updatedAt: new Date() },
        () =>
          updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
            strStatus,
            updatedAt: serverTimestamp()
          }),
        { op: 'update' }
      );

      return { id: tripId, strStatus };
    } catch (error) {
      console.error('Error updating STR status:', error);
      throw error;
    }
  }
};

// Vehicle Services
export const vehicleService = {
  // Add new vehicle
  async addVehicle(vehicleData) {
    try {
      // Import validation constants
      const { VEHICLE_TYPES } = await import('../types');
      
      // Validate vehicleType
      const vehicleType = vehicleData.vehicleType || 'lorry'; // Default to 'lorry'
      if (!VEHICLE_TYPES.includes(vehicleType)) {
        throw new Error(`Invalid vehicleType: ${vehicleType}. Must be one of: ${VEHICLE_TYPES.join(', ')}`);
      }
      
      const record = { ...vehicleData, vehicleType, updatedAt: new Date() };

      await fastSync.writeRecord(COLLECTIONS.VEHICLES, vehicleData.vehicleNumber, record, () =>
        setDoc(
          doc(db, COLLECTIONS.VEHICLES, vehicleData.vehicleNumber),
          { ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
          { merge: true }
        )
      );

      return { ...vehicleData, vehicleType };
    } catch (error) {
      console.error('Error adding vehicle:', error);
      throw error;
    }
  },

  // Get all vehicles
  async getAllVehicles() {
    if (!checkFirebaseAvailability()) {
      return await localVehicleService.getAllVehicles();
    }
    
    try {
      const vehicles = await fastSync.readCollection(COLLECTIONS.VEHICLES, async () => {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.VEHICLES));
        return querySnapshot.docs.map(d => ({ ...d.data(), id: d.id, vehicleNumber: d.id }));
      });

      // Filter client-side to avoid index requirements
      return vehicles.filter(vehicle => vehicle.isActive !== false);
    } catch (error) {
      console.warn('Firebase getAllVehicles failed, falling back to local storage');
      return await localVehicleService.getAllVehicles();
    }
  },

  // Get vehicle by number
  async getVehicle(vehicleNumber) {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.VEHICLES, vehicleNumber));
      if (docSnap.exists()) {
        return {
          ...docSnap.data(),
          vehicleNumber: docSnap.id
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting vehicle:', error);
      throw error;
    }
  },

  // Update vehicle
  async updateVehicle(vehicleNumber, updateData) {
    try {
      // Import validation constants
      const { VEHICLE_TYPES } = await import('../types');
      
      // Validate vehicleType if provided
      let finalUpdateData = { ...updateData };
      if (updateData.vehicleType !== undefined) {
        if (!VEHICLE_TYPES.includes(updateData.vehicleType)) {
          throw new Error(`Invalid vehicleType: ${updateData.vehicleType}. Must be one of: ${VEHICLE_TYPES.join(', ')}`);
        }
        finalUpdateData.vehicleType = updateData.vehicleType;
      }
      
      const vehicleRef = doc(db, COLLECTIONS.VEHICLES, vehicleNumber);
      await updateDoc(vehicleRef, {
        ...finalUpdateData,
        updatedAt: serverTimestamp()
      });
      return { vehicleNumber, ...finalUpdateData };
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  },

  // Delete vehicle (soft delete)
  async deleteVehicle(vehicleNumber) {
    try {
      const vehicleRef = doc(db, COLLECTIONS.VEHICLES, vehicleNumber);
      await updateDoc(vehicleRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
      return vehicleNumber;
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }
};

// Advance Services
export const advanceService = {
  // Add new advance
  async addAdvance(advanceData) {
    if (!checkFirebaseAvailability()) {
      console.log('Using local storage for advance');
      return await localAdvanceService.addAdvance(advanceData);
    }
    
    try {
      const advanceId = newId(COLLECTIONS.ADVANCES);
      const record = { ...advanceData, createdAt: advanceData.createdAt || new Date() };

      const docRef = { id: advanceId };
      await fastSync.writeRecord(COLLECTIONS.ADVANCES, advanceId, record, () =>
        setDoc(doc(db, COLLECTIONS.ADVANCES, advanceId), {
          ...record,
          createdAt: serverTimestamp()
        })
      );

      // Update trip advance summary (only if Firebase is available)
      try {
        await this.updateTripAdvanceSummary(advanceData.tripId, advanceData.advanceAmount);
      } catch (summaryError) {
        console.warn('Failed to update trip advance summary:', summaryError);
        // Don't fail the entire operation if summary update fails
      }
      
      return { ...advanceData, id: docRef.id };
    } catch (error) {
      console.warn('Firebase advance add failed, falling back to local storage');
      return await localAdvanceService.addAdvance(advanceData);
    }
  },

  // Get advances by trip (including orphaned advances with empty tripId for this vehicle)
  async getAdvancesByTrip(tripId, vehicleNumber = null) {
    if (!checkFirebaseAvailability()) {
      return await localAdvanceService.getAdvancesByTrip(tripId);
    }
    
    try {
      // Ensure tripId is valid
      if (!tripId || tripId === '') {
        console.warn('Invalid tripId provided to getAdvancesByTrip:', tripId);
        return [];
      }

      console.log(`Fetching advances for tripId: ${tripId}, vehicleNumber: ${vehicleNumber}`);

      // Get advances with matching tripId
      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ADVANCES),
          where('tripId', '==', tripId)
        )
      );
      
      let advances = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      
      console.log(`Direct query found ${advances.length} advances for tripId ${tripId}:`, advances);
      
      // If we have a vehicleNumber and no advances found, check for orphaned advances
      // (advances with empty tripId but matching vehicle and trip date)
      if (advances.length === 0 && vehicleNumber) {
        console.log(`No advances found for tripId ${tripId}, checking for orphaned advances for vehicle ${vehicleNumber}`);
        
        try {
          // Look for advances with empty tripId but matching vehicle
          const orphanedQuery = await getDocs(
            query(
              collection(db, COLLECTIONS.ADVANCES),
              where('vehicleNumber', '==', vehicleNumber),
              where('tripId', '==', '') // Explicitly look for empty tripId
            )
          );
          
          const orphanedAdvances = orphanedQuery.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          }));
          
          console.log(`Found ${orphanedAdvances.length} orphaned advances for vehicle ${vehicleNumber}`);
          advances = orphanedAdvances;
        } catch (orphanError) {
          console.warn('Error checking for orphaned advances:', orphanError);
        }
      }
      
      console.log(`Final result: ${advances.length} advances for tripId: ${tripId}`);
      
      // Sort client-side by createdAt descending
      return advances.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Firebase getAdvancesByTrip failed:', error);
      console.warn('Falling back to local storage');
      return await localAdvanceService.getAdvancesByTrip(tripId);
    }
  },

  // Get advances by trip categorized by type
  async getAdvancesByTripCategorized(tripId, vehicleNumber = null) {
    const advances = await this.getAdvancesByTrip(tripId, vehicleNumber);
    
    // Import here to avoid circular dependencies
    const { calculateAdvanceTotals } = await import('../types');
    const advanceCalc = calculateAdvanceTotals(advances);
    
    return {
      initial: advanceCalc.initialAdvances,
      additional: advanceCalc.additionalAdvances,
      all: advances,
      totals: {
        initial: advanceCalc.initial,
        additional: advanceCalc.additional,
        grand: advanceCalc.total
      }
    };
  },

  // Get advances by vehicle
  async getAdvancesByVehicle(vehicleNumber) {
    try {
      // Simplified query to avoid composite index requirements
      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ADVANCES),
          where('vehicleNumber', '==', vehicleNumber)
        )
      );
      
      const advances = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      
      // Sort client-side by createdAt descending
      return advances.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Error getting advances by vehicle:', error);
      throw error;
    }
  },

  // Update trip advance summary
  async updateTripAdvanceSummary(tripId, advanceAmount) {
    if (!checkFirebaseAvailability()) {
      console.log('Firebase not available, skipping trip advance summary update');
      return;
    }
    
    // Skip if tripId is empty or invalid
    if (!tripId || tripId === '') {
      console.log('Skipping trip advance summary update - invalid tripId:', tripId);
      return;
    }
    
    try {
      const tripAdvanceRef = doc(db, COLLECTIONS.TRIP_ADVANCES, tripId);
      const docSnap = await getDoc(tripAdvanceRef);
      
      if (docSnap.exists()) {
        await updateDoc(tripAdvanceRef, {
          totalAdvances: increment(advanceAmount),
          lastAdvanceDate: serverTimestamp()
        });
      } else {
        await updateDoc(tripAdvanceRef, {
          tripId: tripId,
          totalAdvances: advanceAmount,
          advances: [],
          lastAdvanceDate: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error updating trip advance summary:', error);
      // Don't throw error, just log it
      console.warn('Failed to update trip advance summary, continuing with advance creation');
    }
  },

  // Get trip advance summary
  async getTripAdvanceSummary(tripId) {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.TRIP_ADVANCES, tripId));
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return { tripId, totalAdvances: 0, advances: [] };
    } catch (error) {
      console.error('Error getting trip advance summary:', error);
      throw error;
    }
  },

  // Get all advances (for reports and consistent data)
  async getAllAdvances() {
    if (!checkFirebaseAvailability()) {
      return await localAdvanceService.getAllAdvances();
    }
    
    try {
      const advances = await fastSync.readCollection(COLLECTIONS.ADVANCES, async () => {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.ADVANCES));
        return querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      });

      // Sort client-side by createdAt descending
      return [...advances].sort(
        (a, b) => (asDate(b.createdAt)?.getTime() || 0) - (asDate(a.createdAt)?.getTime() || 0)
      );
    } catch (error) {
      console.warn('Firebase getAllAdvances failed, falling back to local storage');
      return await localAdvanceService.getAllAdvances();
    }
  },

  // Get advances by date range
  async getAdvancesByDateRange(startDate, endDate) {
    if (!checkFirebaseAvailability()) {
      return await localAdvanceService.getAdvancesByDateRange(startDate, endDate);
    }
    
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ADVANCES),
          where('createdAt', '>=', startDate),
          where('createdAt', '<=', endDate)
        )
      );
      
      const advances = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      
      // Sort client-side by createdAt descending
      return advances.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.warn('Firebase getAdvancesByDateRange failed, falling back to local storage');
      return await localAdvanceService.getAdvancesByDateRange(startDate, endDate);
    }
  }
};

// Village Services
export const villageService = {
  // Add new village
  async addVillage(villageData) {
    try {
      const villageId = newId(COLLECTIONS.VILLAGES);
      const record = { ...villageData, createdAt: new Date(), lastUsed: new Date() };

      await fastSync.writeRecord(COLLECTIONS.VILLAGES, villageId, record, () =>
        setDoc(doc(db, COLLECTIONS.VILLAGES, villageId), {
          ...record,
          createdAt: serverTimestamp(),
          lastUsed: serverTimestamp()
        })
      );

      return { ...villageData, id: villageId };
    } catch (error) {
      console.error('Error adding village:', error);
      throw error;
    }
  },

  // Get all villages
  async getAllVillages() {
    try {
      const villages = await fastSync.readCollection(COLLECTIONS.VILLAGES, async () => {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.VILLAGES));
        return querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      });
      
      // Filter and sort client-side to avoid composite index requirements
      return villages
        .filter(village => village.isActive !== false)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    } catch (error) {
      console.error('Error getting villages:', error);
      throw error;
    }
  },

  // Update village usage
  async updateVillageUsage(villageId) {
    try {
      const cached = (fastSync.getMemory(COLLECTIONS.VILLAGES) || []).find(v => v.id === villageId);
      fastSync.patchCache(COLLECTIONS.VILLAGES, villageId, {
        usageCount: (cached?.usageCount || 0) + 1,
        lastUsed: new Date()
      });

      await updateDoc(doc(db, COLLECTIONS.VILLAGES, villageId), {
        usageCount: increment(1),
        lastUsed: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating village usage:', error);
      throw error;
    }
  },

  // Search villages by name
  async searchVillages(searchTerm) {
    try {
      // Use the simplified getAllVillages and filter client-side
      const allVillages = await this.getAllVillages();
      return allVillages.filter(village => 
        village.villageName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching villages:', error);
      throw error;
    }
  }
};

// Dashboard Services
export const dashboardService = {
  // Get today's metrics — derived from the shared cache instead of three
  // separate Firestore queries.
  async getTodayMetrics() {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const isToday = (value) => {
        const when = asDate(value)?.getTime();
        return when >= start.getTime() && when <= end.getTime();
      };

      const [trips, advances, vehicles] = await Promise.all([
        tripService.getAllTrips(),
        advanceService.getAllAdvances(),
        vehicleService.getAllVehicles()
      ]);

      const todayTrips = trips.filter(trip => isToday(trip.date));
      const todayAdvances = advances.filter(advance => isToday(advance.createdAt));

      return {
        todayTripsCount: todayTrips.length,
        todayAdvancesTotal: todayAdvances.reduce((sum, a) => sum + (a.advanceAmount || 0), 0),
        totalVehicles: vehicles.length,
        recentTrips: todayTrips.slice(0, 5),
        recentAdvances: todayAdvances.slice(0, 5)
      };
    } catch (error) {
      console.error('Error getting today metrics:', error);
      throw error;
    }
  }
};

// Real-time listeners
export const createRealtimeListener = (collectionName, callback, queryConstraints = []) => {
  const q = query(collection(db, collectionName), ...queryConstraints);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    callback(data);
  });
};
