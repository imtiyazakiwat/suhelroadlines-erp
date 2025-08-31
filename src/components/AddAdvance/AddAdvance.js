import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, advanceService } from '../../services/firebaseService';
import { createAdvance, calculateAdvanceTotals, formatCurrency as utilFormatCurrency } from '../../types';
import { format } from 'date-fns';
import './AddAdvance.css';

const AddAdvance = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    selectedTrip: null,
    amount: '',
    date: '2025-08-31',
    note: ''
  });

  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripAdvances, setTripAdvances] = useState({});
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [showVehicleSearch, setShowVehicleSearch] = useState(false);
  const [showTripSelection, setShowTripSelection] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [errors, setErrors] = useState({});
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadTripsForVehicle = React.useCallback(async (vehicleNumber) => {
    try {
      setLoadingTrips(true);
      const tripList = await tripService.getTripsByVehicle(vehicleNumber);
      console.log(`Loaded ${tripList.length} trips for vehicle ${vehicleNumber}:`, tripList);
      
      // Sort by recent (createdAt descending)
      const sortedTrips = tripList.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
        return bTime - aTime;
      });
      
      console.log('Sorted trips:', sortedTrips);
      setTrips(sortedTrips);

      // Load advance summaries for each trip - SIMPLIFIED APPROACH
      const advanceSummaries = {};
      for (const trip of sortedTrips) {
        try {
          // Get all advances for this trip (pass vehicleNumber to handle orphaned advances)
          const allAdvances = await advanceService.getAdvancesByTrip(trip.id, trip.vehicleNumber);
          console.log(`Raw advances fetched for trip ${trip.id}:`, allAdvances);
          
          // Use centralized calculation utility
          const advanceCalc = calculateAdvanceTotals(allAdvances);
          
          console.log(`Trip ${trip.id}: Found ${allAdvances.length} advances, total: ${advanceCalc.total}`);
          
          advanceSummaries[trip.id] = {
            advances: allAdvances,
            initialAdvances: advanceCalc.initialAdvances,
            additionalAdvances: advanceCalc.additionalAdvances,
            initialTotal: advanceCalc.initial,
            additionalTotal: advanceCalc.additional,
            totalAdvances: advanceCalc.total, // Use centralized calculation
            count: advanceCalc.count,
            recentAdvances: allAdvances.slice(0, 3) // Get most recent 3 advances
          };
        } catch (error) {
          console.error(`Error loading advances for trip ${trip.id}:`, error);
          advanceSummaries[trip.id] = { 
            advances: [], 
            initialAdvances: [],
            additionalAdvances: [],
            initialTotal: 0,
            additionalTotal: 0,
            totalAdvances: 0,
            count: 0, 
            recentAdvances: [] 
          };
        }
      }
      setTripAdvances(advanceSummaries);
    } catch (error) {
      console.error('Error loading trips:', error);
      showToastMessage('Error loading trips for vehicle');
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    if (formData.vehicleNumber) {
      loadTripsForVehicle(formData.vehicleNumber);
    }
  }, [formData.vehicleNumber, loadTripsForVehicle]);

  const loadVehicles = async () => {
    try {
      const vehicleList = await vehicleService.getAllVehicles();
      setVehicles(vehicleList);
      setFilteredVehicles(vehicleList);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleVehicleSelect = (vehicle) => {
    setFormData(prev => ({
      ...prev,
      vehicleNumber: vehicle.vehicleNumber,
      selectedTrip: null // Reset trip selection when vehicle changes
    }));
    setShowVehicleSearch(false);
    setVehicleSearchQuery('');
  };

  const handleTripSelect = (trip) => {
    setFormData(prev => ({
      ...prev,
      selectedTrip: trip
    }));
    setShowTripSelection(false);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle number is required';
    }

    if (!formData.selectedTrip) {
      newErrors.selectedTrip = 'Trip selection is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid advance amount is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }

    setLoading(true);

    try {
      console.log('Selected trip object:', formData.selectedTrip);
      console.log('Selected trip ID:', formData.selectedTrip?.id);
      
      if (!formData.selectedTrip?.id) {
        throw new Error('No trip ID available for the selected trip');
      }

      const advanceData = createAdvance({
        vehicleNumber: formData.vehicleNumber,
        tripId: formData.selectedTrip.id,
        tripDate: formData.selectedTrip.date,
        advanceAmount: parseFloat(formData.amount),
        note: formData.note.trim(),
        advanceType: 'additional' // Mark as additional advance
      });

      console.log('Creating advance with data:', advanceData);

      await advanceService.addAdvance(advanceData);

      showToastMessage('Advance added successfully!');

      // Refresh the trip data to show updated advances
      if (formData.vehicleNumber) {
        await loadTripsForVehicle(formData.vehicleNumber);
      }

      // Reset form and navigate back
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (error) {
      console.error('Error adding advance:', error);
      showToastMessage('Error adding advance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleVehicleSearch = (query) => {
    setVehicleSearchQuery(query);
    if (query.trim()) {
      const filtered = vehicles.filter(vehicle =>
        vehicle.vehicleNumber.toLowerCase().includes(query.toLowerCase()) ||
        vehicle.driverName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredVehicles(filtered);
    } else {
      setFilteredVehicles(vehicles);
    }
  };

  const formatCurrency = (amount) => {
    return utilFormatCurrency(amount);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'MMM dd, yyyy');
  };

  const getTripAdvanceInfo = (tripId) => {
    const info = tripAdvances[tripId];
    const result = info || { 
      advances: [], 
      initialAdvances: [],
      additionalAdvances: [],
      initialTotal: 0,
      additionalTotal: 0,
      totalAdvances: 0, 
      count: 0, 
      recentAdvances: [] 
    };
    console.log(`getTripAdvanceInfo for trip ${tripId}:`, result);
    return result;
  };

  return (
    <div className="add-advance-container">
      {/* Toast Notification */}
      {showToast && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}

      <div className="form-card">
        <h2>Add Advance</h2>

        <div className="form-list">
          {/* Vehicle Number */}
          <div className={`form-item ${errors.vehicleNumber ? 'error-field' : ''}`}>
            <label>Vehicle Number</label>
            <button 
              className="select-button"
              onClick={() => setShowVehicleSearch(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
              </svg>
              <span>{formData.vehicleNumber || "Select Vehicle"}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="arrow">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </button>
            {errors.vehicleNumber && (
              <div className="error-message">{errors.vehicleNumber}</div>
            )}
          </div>

          {/* Trip Selection */}
          {formData.vehicleNumber && (
            <div className={`form-item ${errors.selectedTrip ? 'error-field' : ''}`}>
              <label>Select Trip</label>
              <button 
                className="select-button"
                onClick={() => !loadingTrips && setShowTripSelection(true)}
                disabled={loadingTrips}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                </svg>
                <span>
                  {formData.selectedTrip 
                    ? `Trip #${formData.selectedTrip.slNumber}` 
                    : loadingTrips ? "Loading..." : "Select Trip"
                  }
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="arrow">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </button>
              {errors.selectedTrip && (
                <div className="error-message">{errors.selectedTrip}</div>
              )}
            </div>
          )}

          {/* Selected Trip Details */}
          {formData.selectedTrip && (
            <div className="selected-trip-section">
              <h4>Latest Trip Advances</h4>
              <div className="trip-summary">
                <div className="trip-info-row">
                  <span className="label">Trip Date:</span>
                  <span className="value">{formatDate(formData.selectedTrip.date)}</span>
                </div>
                <div className="trip-info-row">
                  <span className="label">STR:</span>
                  <span className="value">{formData.selectedTrip.strNumber}</span>
                </div>
                <div className="trip-info-row">
                  <span className="label">Quantity:</span>
                  <span className="value">{formData.selectedTrip.quantity}</span>
                </div>
                <div className="trip-info-row">
                  <span className="label">Initial Advance:</span>
                  <span className="value">
                    {formatCurrency(getTripAdvanceInfo(formData.selectedTrip.id).initialTotal)}
                    <small className="advance-count">
                      ({getTripAdvanceInfo(formData.selectedTrip.id).initialAdvances.length} record{getTripAdvanceInfo(formData.selectedTrip.id).initialAdvances.length !== 1 ? 's' : ''})
                    </small>
                  </span>
                </div>
                <div className="trip-info-row">
                  <span className="label">Additional Advances:</span>
                  <span className="value">
                    {formatCurrency(getTripAdvanceInfo(formData.selectedTrip.id).additionalTotal)}
                    <small className="advance-count">
                      ({getTripAdvanceInfo(formData.selectedTrip.id).additionalAdvances.length} record{getTripAdvanceInfo(formData.selectedTrip.id).additionalAdvances.length !== 1 ? 's' : ''})
                    </small>
                  </span>
                </div>
                <div className="trip-info-row">
                  <span className="label">Grand Total Advances:</span>
                  <span className="value advance-amount">
                    {formatCurrency(getTripAdvanceInfo(formData.selectedTrip.id).totalAdvances)}
                    <small className="advance-count">
                      ({getTripAdvanceInfo(formData.selectedTrip.id).count} total record{getTripAdvanceInfo(formData.selectedTrip.id).count !== 1 ? 's' : ''})
                    </small>
                  </span>
                </div>
              </div>

              {/* Recent Advances */}
              {getTripAdvanceInfo(formData.selectedTrip.id).recentAdvances.length > 0 && (
                <div className="recent-advances">
                  <h5>Recent Advances</h5>
                  {getTripAdvanceInfo(formData.selectedTrip.id).recentAdvances.map((advance, index) => (
                    <div key={advance.id || index} className="advance-item">
                      <div className="advance-main">
                        <span className="advance-date">
                          {format(new Date(advance.createdAt?.toDate?.() || advance.createdAt), 'MMM dd')}
                        </span>
                        <span className="advance-amount">
                          {formatCurrency(advance.advanceAmount)}
                        </span>
                      </div>
                      <div className="advance-type">
                        <span className={`advance-type-badge ${advance.advanceType || 'additional'}`}>
                          {advance.advanceType === 'initial' ? 'Initial' : 'Additional'}
                        </span>
                        {advance.note && (
                          <span className="advance-note">{advance.note}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className={`form-item ${errors.amount ? 'error-field' : ''}`}>
            <label>Amount</label>
            <input
              type="number"
              placeholder="₹ Enter amount"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
            />
            {errors.amount && (
              <div className="error-message">{errors.amount}</div>
            )}
          </div>

          {/* Date */}
          <div className="form-item">
            <label>Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="form-item">
            <label>Note</label>
            <textarea
              placeholder="Enter note..."
              value={formData.note}
              onChange={(e) => handleInputChange('note', e.target.value)}
              rows="3"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !formData.selectedTrip}
          >
            {loading ? 'Adding...' : 'Add Advance'}
          </button>
        </div>
      </div>

      {/* Vehicle Search Modal */}
      {showVehicleSearch && (
        <div className="modal-overlay" onClick={() => setShowVehicleSearch(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Vehicle</h3>
              <button 
                className="close-button"
                onClick={() => setShowVehicleSearch(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="search-container">
              <input
                type="text"
                placeholder="Search vehicles..."
                value={vehicleSearchQuery}
                onChange={(e) => handleVehicleSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="modal-list">
              {filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.vehicleNumber}
                  className="list-item"
                  onClick={() => handleVehicleSelect(vehicle)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                    <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                    <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
                  </svg>
                  <div className="list-item-content">
                    <div className="list-item-title">{vehicle.vehicleNumber}</div>
                    <div className="list-item-subtitle">{vehicle.driverName} • {vehicle.mobileNumber}</div>
                  </div>
                </div>
              ))}

              {filteredVehicles.length === 0 && vehicleSearchQuery && (
                <div className="list-item disabled">No vehicles found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trip Selection Modal */}
      {showTripSelection && (
        <div className="modal-overlay" onClick={() => setShowTripSelection(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Trips for {formData.vehicleNumber}</h3>
              <button 
                className="close-button"
                onClick={() => setShowTripSelection(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="trip-table">
              <div className="trip-header">
                <span className="trip-col trip-date">Trip Date</span>
                <span className="trip-col trip-str">STR</span>
                <span className="trip-col trip-qty">Qty</span>
                <span className="trip-col trip-advances">Advances</span>
              </div>

              <div className="trip-rows">
                {trips.length === 0 ? (
                  <div className="no-trips">No trips found for this vehicle</div>
                ) : (
                  trips.map((trip) => {
                    const advanceInfo = getTripAdvanceInfo(trip.id);
                    return (
                      <div
                        key={trip.id}
                        className="trip-row"
                        onClick={() => handleTripSelect(trip)}
                      >
                        <span className="trip-col trip-date">{formatDate(trip.date)}</span>
                        <span className="trip-col trip-str">{trip.strNumber}</span>
                        <span className="trip-col trip-qty">{trip.quantity}</span>
                        <span className="trip-col trip-advances">
                          {formatCurrency(advanceInfo.totalAdvances)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddAdvance;