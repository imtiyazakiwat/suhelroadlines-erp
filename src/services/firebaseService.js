import { 
  collection, 
  doc, 
  addDoc, 
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

// Trip Services
export const tripService = {
  // Add new trip
  async addTrip(tripData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.TRIPS), {
        ...tripData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const tripWithId = { ...tripData, id: docRef.id };
      
      // If trip has initial advance amount, create an initial advance record
      if (tripData.advanceAmount && tripData.advanceAmount > 0) {
        try {
          const initialAdvanceData = {
            vehicleNumber: tripData.vehicleNumber,
            tripId: docRef.id,
            tripDate: tripData.date,
            advanceAmount: tripData.advanceAmount,
            advanceType: 'initial',
            note: 'Initial advance amount set during trip creation',
            isSettled: false,
            createdAt: new Date()
          };
          
          await addDoc(collection(db, COLLECTIONS.ADVANCES), {
            ...initialAdvanceData,
            createdAt: serverTimestamp()
          });
          
          console.log('Created initial advance record for trip:', docRef.id);
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

  // Get all trips
  async getAllTrips() {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, COLLECTIONS.TRIPS), orderBy('createdAt', 'desc'))
      );
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
    } catch (error) {
      console.error('Error getting trips:', error);
      throw error;
    }
  },

  // Get trips by date range
  async getTripsByDateRange(startDate, endDate) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TRIPS),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'desc')
        )
      );
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
    } catch (error) {
      console.error('Error getting trips by date range:', error);
      throw error;
    }
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
      const tripRef = doc(db, COLLECTIONS.TRIPS, tripId);
      await updateDoc(tripRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { id: tripId, ...updateData };
    } catch (error) {
      console.error('Error updating trip:', error);
      throw error;
    }
  },

  // Delete trip
  async deleteTrip(tripId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.TRIPS, tripId));
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
  }
};

// Vehicle Services
export const vehicleService = {
  // Add new vehicle
  async addVehicle(vehicleData) {
    try {
      const vehicleRef = doc(db, COLLECTIONS.VEHICLES, vehicleData.vehicleNumber);
      await setDoc(vehicleRef, {
        ...vehicleData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      return vehicleData;
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
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.VEHICLES));
      const vehicles = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        vehicleNumber: doc.id
      }));
      
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
      const vehicleRef = doc(db, COLLECTIONS.VEHICLES, vehicleNumber);
      await updateDoc(vehicleRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { vehicleNumber, ...updateData };
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
      const docRef = await addDoc(collection(db, COLLECTIONS.ADVANCES), {
        ...advanceData,
        createdAt: serverTimestamp()
      });
      
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
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.ADVANCES));
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
      const docRef = await addDoc(collection(db, COLLECTIONS.VILLAGES), {
        ...villageData,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp()
      });
      return { ...villageData, id: docRef.id };
    } catch (error) {
      console.error('Error adding village:', error);
      throw error;
    }
  },

  // Get all villages
  async getAllVillages() {
    try {
      // Simplified query to avoid index requirements
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.VILLAGES));
      const villages = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      
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
      const villageRef = doc(db, COLLECTIONS.VILLAGES, villageId);
      await updateDoc(villageRef, {
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
  // Get today's metrics
  async getTodayMetrics() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      // Get today's trips
      const tripsQuery = query(
        collection(db, COLLECTIONS.TRIPS),
        where('date', '>=', startOfDay),
        where('date', '<=', endOfDay)
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      const todayTrips = tripsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // Get today's advances
      const advancesQuery = query(
        collection(db, COLLECTIONS.ADVANCES),
        where('createdAt', '>=', startOfDay),
        where('createdAt', '<=', endOfDay)
      );
      const advancesSnapshot = await getDocs(advancesQuery);
      const todayAdvances = advancesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // Get total vehicles
      const vehiclesSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.VEHICLES), where('isActive', '==', true))
      );
      
      return {
        todayTripsCount: todayTrips.length,
        todayAdvancesTotal: todayAdvances.reduce((sum, advance) => sum + (advance.advanceAmount || 0), 0),
        totalVehicles: vehiclesSnapshot.size,
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
