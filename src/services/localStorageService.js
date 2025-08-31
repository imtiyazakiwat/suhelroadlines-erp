// Local Storage Service - Fallback when Firebase is unavailable

// Storage keys
const STORAGE_KEYS = {
  TRIPS: 'suhelroadline_trips',
  VEHICLES: 'suhelroadline_vehicles',
  ADVANCES: 'suhelroadline_advances',
  VILLAGES: 'suhelroadline_villages',
  SETTINGS: 'suhelroadline_settings'
};

// Utility functions
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const getStorageData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading from localStorage for key ${key}:`, error);
    return [];
  }
};

const setStorageData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error writing to localStorage for key ${key}:`, error);
    return false;
  }
};

// Trip Services
export const localTripService = {
  async addTrip(tripData) {
    const trips = getStorageData(STORAGE_KEYS.TRIPS);
    const newTrip = {
      ...tripData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    trips.unshift(newTrip);
    setStorageData(STORAGE_KEYS.TRIPS, trips);
    return newTrip;
  },

  async getAllTrips() {
    const trips = getStorageData(STORAGE_KEYS.TRIPS);
    return trips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getTripsByDateRange(startDate, endDate) {
    const trips = getStorageData(STORAGE_KEYS.TRIPS);
    return trips.filter(trip => {
      const tripDate = new Date(trip.date);
      return tripDate >= startDate && tripDate <= endDate;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async getTripsByVehicle(vehicleNumber) {
    const trips = getStorageData(STORAGE_KEYS.TRIPS);
    return trips
      .filter(trip => trip.vehicleNumber === vehicleNumber)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getNextSlNumber() {
    const trips = getStorageData(STORAGE_KEYS.TRIPS);
    if (trips.length === 0) return 1;
    const maxSlNumber = Math.max(...trips.map(trip => trip.slNumber || 0));
    return maxSlNumber + 1;
  }
};

// Vehicle Services
export const localVehicleService = {
  async addVehicle(vehicleData) {
    const vehicles = getStorageData(STORAGE_KEYS.VEHICLES);
    const newVehicle = {
      ...vehicleData,
      id: vehicleData.vehicleNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    
    // Remove existing vehicle with same number
    const filteredVehicles = vehicles.filter(v => v.vehicleNumber !== vehicleData.vehicleNumber);
    filteredVehicles.push(newVehicle);
    
    setStorageData(STORAGE_KEYS.VEHICLES, filteredVehicles);
    return newVehicle;
  },

  async getAllVehicles() {
    const vehicles = getStorageData(STORAGE_KEYS.VEHICLES);
    return vehicles.filter(vehicle => vehicle.isActive !== false);
  },

  async getVehicle(vehicleNumber) {
    const vehicles = getStorageData(STORAGE_KEYS.VEHICLES);
    return vehicles.find(vehicle => vehicle.vehicleNumber === vehicleNumber);
  },

  async updateVehicle(vehicleNumber, updateData) {
    const vehicles = getStorageData(STORAGE_KEYS.VEHICLES);
    const index = vehicles.findIndex(v => v.vehicleNumber === vehicleNumber);
    
    if (index !== -1) {
      vehicles[index] = {
        ...vehicles[index],
        ...updateData,
        updatedAt: new Date()
      };
      setStorageData(STORAGE_KEYS.VEHICLES, vehicles);
      return vehicles[index];
    }
    return null;
  }
};

// Advance Services
export const localAdvanceService = {
  async addAdvance(advanceData) {
    const advances = getStorageData(STORAGE_KEYS.ADVANCES);
    const newAdvance = {
      ...advanceData,
      id: generateId(),
      createdAt: new Date()
    };
    advances.unshift(newAdvance);
    setStorageData(STORAGE_KEYS.ADVANCES, advances);
    return newAdvance;
  },

  async getAdvancesByTrip(tripId) {
    const advances = getStorageData(STORAGE_KEYS.ADVANCES);
    return advances
      .filter(advance => advance.tripId === tripId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getAdvancesByVehicle(vehicleNumber) {
    const advances = getStorageData(STORAGE_KEYS.ADVANCES);
    return advances
      .filter(advance => advance.vehicleNumber === vehicleNumber)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getAllAdvances() {
    const advances = getStorageData(STORAGE_KEYS.ADVANCES);
    return advances.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getAdvancesByDateRange(startDate, endDate) {
    const advances = getStorageData(STORAGE_KEYS.ADVANCES);
    return advances
      .filter(advance => {
        const advanceDate = new Date(advance.createdAt);
        return advanceDate >= startDate && advanceDate <= endDate;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

// Village Services
export const localVillageService = {
  async addVillage(villageData) {
    const villages = getStorageData(STORAGE_KEYS.VILLAGES);
    const newVillage = {
      ...villageData,
      id: generateId(),
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 1,
      isActive: true
    };
    villages.push(newVillage);
    setStorageData(STORAGE_KEYS.VILLAGES, villages);
    return newVillage;
  },

  async getAllVillages() {
    const villages = getStorageData(STORAGE_KEYS.VILLAGES);
    return villages
      .filter(village => village.isActive !== false)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  },

  async searchVillages(searchTerm) {
    const villages = await this.getAllVillages();
    return villages.filter(village => 
      village.villageName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
};

// Dashboard Services
export const localDashboardService = {
  async getTodayMetrics() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const trips = getStorageData(STORAGE_KEYS.TRIPS);
    const advances = getStorageData(STORAGE_KEYS.ADVANCES);
    const vehicles = getStorageData(STORAGE_KEYS.VEHICLES);

    const todayTrips = trips.filter(trip => {
      const tripDate = new Date(trip.date);
      return tripDate >= startOfDay && tripDate <= endOfDay;
    });

    const todayAdvances = advances.filter(advance => {
      const advanceDate = new Date(advance.createdAt);
      return advanceDate >= startOfDay && advanceDate <= endOfDay;
    });

    return {
      todayTripsCount: todayTrips.length,
      todayAdvancesTotal: todayAdvances.reduce((sum, advance) => sum + (advance.advanceAmount || 0), 0),
      totalVehicles: vehicles.filter(v => v.isActive !== false).length,
      recentTrips: todayTrips.slice(0, 5),
      recentAdvances: todayAdvances.slice(0, 5)
    };
  }
};

// Initialize with sample data if empty
export const initializeSampleData = () => {
  console.log('Initializing sample data...');
  const vehicles = getStorageData(STORAGE_KEYS.VEHICLES);
  const villages = getStorageData(STORAGE_KEYS.VILLAGES);
  const trips = getStorageData(STORAGE_KEYS.TRIPS);

  console.log('Existing vehicles:', vehicles.length);
  console.log('Existing trips:', trips.length);

  // Add sample vehicles if none exist
  if (vehicles.length === 0) {
    const sampleVehicles = [
      { vehicleNumber: 'MH12AB1234', driverName: 'Ahmed Khan', mobileNumber: '9876543210' },
      { vehicleNumber: 'MH12CD5678', driverName: 'Ravi Sharma', mobileNumber: '9876543211' },
      { vehicleNumber: 'MH12EF9012', driverName: 'Suresh Patil', mobileNumber: '9876543212' }
    ];
    
    sampleVehicles.forEach(vehicle => {
      localVehicleService.addVehicle(vehicle);
    });
    console.log('Sample vehicles added to local storage');
  }
  
  // Add sample trips if none exist
  if (trips.length === 0) {
    const sampleTrips = [
      {
        slNumber: 1,
        date: new Date(),
        vehicleNumber: 'MH12AB1234',
        strNumber: 'STR001',
        villages: ['Pune', 'Mumbai'],
        quantity: 100,
        driverName: 'Ahmed Khan',
        mobileNumber: '9876543210',
        advanceAmount: 0
      },
      {
        slNumber: 2,
        date: new Date(),
        vehicleNumber: 'MH12CD5678',
        strNumber: 'STR002',
        villages: ['Nashik', 'Aurangabad'],
        quantity: 150,
        driverName: 'Ravi Sharma',
        mobileNumber: '9876543211',
        advanceAmount: 0
      }
    ];
    
    sampleTrips.forEach(trip => {
      localTripService.addTrip(trip);
    });
    console.log('Sample trips added to local storage');
  }

  // Add sample villages if none exist
  if (villages.length === 0) {
    const sampleVillages = [
      { villageName: 'Pune' },
      { villageName: 'Mumbai' },
      { villageName: 'Nashik' },
      { villageName: 'Aurangabad' },
      { villageName: 'Nagpur' }
    ];
    
    sampleVillages.forEach(village => {
      localVillageService.addVillage(village);
    });
    console.log('Sample villages added to local storage');
  }
};

// Clear all local storage data (for testing)
export const clearAllLocalData = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('All local storage data cleared');
};
