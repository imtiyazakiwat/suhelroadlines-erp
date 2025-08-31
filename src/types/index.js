// Data Models for SuhelRoadline Travel ERP

// Trip Entry Model
export const createTripEntry = ({
  slNumber,
  date,
  vehicleNumber,
  strNumber,
  villages = [],
  quantity,
  driverName,
  mobileNumber,
  advanceAmount = 0
}) => ({
  id: null, // Will be set by Firestore
  slNumber: slNumber || 0,
  date: date || new Date(),
  vehicleNumber: vehicleNumber || '',
  strNumber: strNumber || '',
  villages: villages,
  quantity: quantity || 0,
  driverName: driverName || '',
  mobileNumber: mobileNumber || '',
  advanceAmount: advanceAmount,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Vehicle Model
export const createVehicle = ({
  vehicleNumber,
  driverName,
  mobileNumber
}) => ({
  vehicleNumber: vehicleNumber || '',
  driverName: driverName || '',
  mobileNumber: mobileNumber || '',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Advance Model
export const createAdvance = ({
  vehicleNumber,
  tripId,
  tripDate,
  advanceAmount,
  note = '',
  advanceType = 'additional' // 'initial' or 'additional'
}) => ({
  id: null, // Will be set by Firestore
  vehicleNumber: vehicleNumber || '',
  tripId: tripId || '',
  tripDate: tripDate || new Date(),
  advanceAmount: advanceAmount || 0,
  advanceType: advanceType, // NEW: Type of advance
  note: note,
  isSettled: false,
  createdAt: new Date()
});

// Village Model
export const createVillage = ({
  villageName
}) => ({
  id: null, // Will be set by Firestore
  villageName: villageName || '',
  isActive: true,
  usageCount: 0,
  lastUsed: new Date()
});

// Trip Advance Summary Model (for quick queries)
export const createTripAdvanceSummary = ({
  tripId,
  totalAdvances = 0,
  advances = []
}) => ({
  tripId: tripId || '',
  totalAdvances: totalAdvances,
  advances: advances,
  lastAdvanceDate: new Date()
});

// App Settings Model
export const createAppSettings = ({
  userId,
  lastSlNumber = 0,
  preferences = {}
}) => ({
  userId: userId || '',
  lastSlNumber: lastSlNumber,
  preferences: preferences
});

// Utility Functions for Advance Calculations
export const calculateAdvanceTotals = (advances = []) => {
  if (!Array.isArray(advances) || advances.length === 0) {
    return {
      total: 0,
      initial: 0,
      additional: 0,
      count: 0,
      initialCount: 0,
      additionalCount: 0,
      initialAdvances: [],
      additionalAdvances: []
    };
  }

  // Categorize advances
  const initialAdvances = advances.filter(advance => advance.advanceType === 'initial');
  const additionalAdvances = advances.filter(advance => 
    advance.advanceType === 'additional' || 
    (!advance.advanceType && advance.tripId) // Handle old records without advanceType
  );

  // Calculate totals
  const initialTotal = initialAdvances.reduce((sum, advance) => sum + (advance.advanceAmount || 0), 0);
  const additionalTotal = additionalAdvances.reduce((sum, advance) => sum + (advance.advanceAmount || 0), 0);
  const grandTotal = initialTotal + additionalTotal;

  return {
    total: grandTotal,
    initial: initialTotal,
    additional: additionalTotal,
    count: advances.length,
    initialCount: initialAdvances.length,
    additionalCount: additionalAdvances.length,
    initialAdvances: initialAdvances,
    additionalAdvances: additionalAdvances
  };
};

// Format currency for display
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount || 0);
};
