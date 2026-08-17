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
  advanceAmount = 0,
  vehicleType = 'lorry',
  strStatus = 'not received',
  images = []
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
  vehicleType: vehicleType,
  strStatus: strStatus,
  images: Array.isArray(images) ? images : [],
  createdAt: new Date(),
  updatedAt: new Date()
});

// Valid vehicle types
export const VEHICLE_TYPES = ['lorry', 'tempo', 'pickup'];

// Valid STR status values
export const STR_STATUS_VALUES = ['not received', 'Received'];

// Vehicle Model
//
// `driverName` and `mobileNumber` are both optional: plenty of vehicles are
// booked before anyone knows who is driving, and refusing to record the vehicle
// over a missing name blocked real work.
//
// `isOwn` marks the firm's own lorries apart from hired ones. It is a boolean
// rather than a status enum because the only question being asked is "is this
// mine", and it defaults to **false** on purpose: an existing record has never
// been asked, and defaulting to true would claim ownership nobody entered. Read
// it as `vehicle.isOwn === true` everywhere, so a missing field means
// "not marked as mine" instead of undefined.
export const createVehicle = ({
  vehicleNumber,
  driverName,
  mobileNumber,
  vehicleType = 'lorry',
  isOwn = false
}) => ({
  vehicleNumber: vehicleNumber || '',
  driverName: driverName || '',
  mobileNumber: mobileNumber || '',
  vehicleType: vehicleType,
  isOwn: isOwn === true,
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
  advanceType = 'additional', // 'initial' or 'additional'
  images = []
}) => ({
  id: null, // Will be set by Firestore
  vehicleNumber: vehicleNumber || '',
  tripId: tripId || '',
  tripDate: tripDate || new Date(),
  advanceAmount: advanceAmount || 0,
  advanceType: advanceType, // NEW: Type of advance
  note: note,
  images: Array.isArray(images) ? images : [],
  isSettled: false,
  createdAt: new Date()
});

// Village Model
// `code` is the short form used on paperwork (see services/textService.js).
// Trips keep storing village *names*, not codes, so existing records stay valid
// and no migration is needed; the code is resolved for display from this list.
export const createVillage = ({
  villageName,
  code = ''
}) => ({
  id: null, // Will be set by Firestore
  villageName: villageName || '',
  code: code || '',
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
