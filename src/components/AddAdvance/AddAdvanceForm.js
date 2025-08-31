import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, advanceService } from '../../services/firebaseService';
import { createAdvance, calculateAdvanceTotals, formatCurrency as utilFormatCurrency } from '../../types';
import { format } from 'date-fns';
import Toast from '../Common/Toast';
import './AddAdvanceForm.css';

const AddAdvanceForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    selectedTrip: null,
    advanceAmount: '',
    note: ''
  });
  
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [errors, setErrors] = useState({});
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [tripAdvances, setTripAdvances] = useState({});
  const [totalAdvancesForTrip, setTotalAdvancesForTrip] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    if (mounted) {
      loadVehicles();
    }
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const loadVehicles = async () => {
    try {
      console.log('Loading vehicles...');
      const vehicleList = await vehicleService.getAllVehicles();
      console.log('Vehicles loaded:', vehicleList);
      setVehicles(vehicleList);
      setFilteredVehicles(vehicleList);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      showToastMessage('Error loading vehicles');
    }
  };

  const loadTripsForVehicle = async (vehicleNumber) => {
    try {
      setLoadingTrips(true);
      console.log('Loading trips for vehicle:', vehicleNumber);
      const tripList = await tripService.getTripsByVehicle(vehicleNumber);
      console.log('Trips loaded:', tripList);
      
      // Ensure each trip has a proper ID
      const tripsWithIds = tripList.map(trip => ({
        ...trip,
        id: trip.id || `trip-${trip.slNumber}-${trip.date?.getTime?.() || Date.now()}`
      }));
      
      setTrips(tripsWithIds);
      
      // Load advances for each trip
      const advancesPromises = tripsWithIds.map(async (trip) => {
        try {
          const advances = await advanceService.getAdvancesByTrip(trip.id);
          return { tripId: trip.id, advances };
        } catch (error) {
          console.error(`Error loading advances for trip ${trip.id}:`, error);
          return { tripId: trip.id, advances: [] };
        }
      });
      
      const advancesResults = await Promise.all(advancesPromises);
      const advancesMap = {};
      advancesResults.forEach(({ tripId, advances }) => {
        advancesMap[tripId] = advances;
      });
      setTripAdvances(advancesMap);
      
    } catch (error) {
      console.error('Error loading trips:', error);
      showToastMessage('Error loading trips for vehicle');
    } finally {
      setLoadingTrips(false);
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

  const handleVehicleSearch = (query) => {
    setVehicleSearchQuery(query);
    setFormData(prev => ({ ...prev, vehicleNumber: query, selectedTrip: null }));
    
    if (query.trim()) {
      const filtered = vehicles.filter(vehicle =>
        vehicle.vehicleNumber.toLowerCase().includes(query.toLowerCase()) ||
        vehicle.driverName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredVehicles(filtered);
      setShowVehicleDropdown(true);
    } else {
      setFilteredVehicles(vehicles);
      setShowVehicleDropdown(false);
      setTrips([]);
      setTripAdvances({});
    }
  };

  const handleVehicleSelect = (vehicle) => {
    setFormData(prev => ({
      ...prev,
      vehicleNumber: vehicle.vehicleNumber,
      selectedTrip: null
    }));
    setVehicleSearchQuery(vehicle.vehicleNumber);
    setShowVehicleDropdown(false);
    setTrips([]);
    setTripAdvances({});
    setTotalAdvancesForTrip(0);
    loadTripsForVehicle(vehicle.vehicleNumber);
  };

  const handleTripSelect = (trip) => {
    console.log('Trip selected:', trip);
    setFormData(prev => ({
      ...prev,
      selectedTrip: trip
    }));
    
    // Calculate total advances for this trip using centralized utility
    const advances = tripAdvances[trip.id] || [];
    const advanceCalc = calculateAdvanceTotals(advances);
    setTotalAdvancesForTrip(advanceCalc.total);
    console.log('Total advances for trip:', advanceCalc.total);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle number is required';
    }
    
    if (!formData.selectedTrip) {
      newErrors.selectedTrip = 'Trip selection is required';
    }
    
    if (!formData.advanceAmount || parseFloat(formData.advanceAmount) <= 0) {
      newErrors.advanceAmount = 'Valid advance amount is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    
    if (!validateForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    setLoading(true);
    
    try {
      const advanceData = createAdvance({
        vehicleNumber: formData.vehicleNumber,
        tripId: formData.selectedTrip.id,
        tripDate: formData.selectedTrip.date,
        advanceAmount: parseFloat(formData.advanceAmount),
        note: formData.note.trim()
      });
      
      console.log('Creating advance with data:', advanceData);
      const result = await advanceService.addAdvance(advanceData);
      console.log('Advance created successfully:', result);
      
      showToastMessage('Advance added successfully!');
      
      // Refresh trip advances
      await loadTripsForVehicle(formData.vehicleNumber);
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        selectedTrip: null,
        advanceAmount: '',
        note: ''
      }));
      setTotalAdvancesForTrip(0);
      
      // Navigate back after success
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

  const formatCurrency = (amount) => {
    return utilFormatCurrency(amount);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'MMM dd, yyyy');
  };

  const getTripAdvanceInfo = (tripId) => {
    if (!tripId) return { advances: [], totalAdvances: 0, count: 0 };
    const advances = tripAdvances[tripId] || [];
    const advanceCalc = calculateAdvanceTotals(advances);
    return { advances, totalAdvances: advanceCalc.total, count: advanceCalc.count };
  };

  return (
    <div className="add-advance-form">
      <div className="form-header">
        <h1 className="form-title">Add Advance Payment</h1>
        <p className="form-subtitle">Record advance payments against specific trip entries</p>
      </div>

      <form onSubmit={handleSubmit} className="advance-form">
        {/* Vehicle Selection */}
        <div className="form-group">
          <label className="form-label">Vehicle Number</label>
          <div className="search-container">
            <input
              type="text"
              value={vehicleSearchQuery || formData.vehicleNumber}
              onChange={(e) => handleVehicleSearch(e.target.value)}
              onFocus={() => setShowVehicleDropdown(true)}
              placeholder="Search vehicle number or driver name"
              className={`form-input search-input ${errors.vehicleNumber ? 'error' : ''}`}
            />
            <svg className="search-icon icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            
            {showVehicleDropdown && filteredVehicles.length > 0 && (
              <div className="dropdown">
                {filteredVehicles.map((vehicle) => (
                  <div
                    key={vehicle.vehicleNumber}
                    className="dropdown-item"
                    onClick={() => handleVehicleSelect(vehicle)}
                  >
                    <div className="dropdown-primary">{vehicle.vehicleNumber}</div>
                    <div className="dropdown-secondary">{vehicle.driverName} • {vehicle.mobileNumber}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.vehicleNumber && <span className="error-text">{errors.vehicleNumber}</span>}
        </div>

        {/* Trip Selection */}
        {formData.vehicleNumber && (
          <div className="form-group">
            <label className="form-label">Select Trip</label>
            {loadingTrips ? (
              <div className="loading-state">
                <div className="loading"></div>
                <span>Loading trips...</span>
              </div>
            ) : trips.length === 0 ? (
              <div className="empty-state">
                <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
                  <line x1="8" y1="1" x2="8" y2="4"></line>
                  <line x1="16" y1="1" x2="16" y2="4"></line>
                </svg>
                <p>No trips found for this vehicle</p>
              </div>
            ) : (
              <div className="trips-grid">
                {trips.map((trip, index) => {
                  const advanceInfo = getTripAdvanceInfo(trip.id);
                  const isSelected = formData.selectedTrip?.id === trip.id;
                  
                  return (
                    <div
                      key={trip.id || `trip-${index}`}
                      className={`trip-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleTripSelect(trip)}
                    >
                      <div className="trip-header">
                        <div className="trip-number">Trip #{trip.slNumber}</div>
                        <div className="trip-date">{formatDate(trip.date)}</div>
                        {advanceInfo.count > 0 && (
                          <div className="advance-badge">
                            {advanceInfo.count} advance{advanceInfo.count > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                      
                      <div className="trip-details">
                        <div className="detail-row">
                          <span className="label">STR:</span>
                          <span className="value">{trip.strNumber}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Villages:</span>
                          <span className="value">{trip.villages?.join(', ') || 'N/A'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Quantity:</span>
                          <span className="value">{trip.quantity}</span>
                        </div>
                        {advanceInfo.totalAdvances > 0 && (
                          <div className="detail-row advance-row">
                            <span className="label">Previous Advances:</span>
                            <span className="value advance-amount">{formatCurrency(advanceInfo.totalAdvances)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {errors.selectedTrip && <span className="error-text">{errors.selectedTrip}</span>}
          </div>
        )}

        {/* Selected Trip Details and Advance History */}
        {formData.selectedTrip && (
          <div className="selected-trip-details">
            <h3>Trip Details</h3>
            <div className="trip-info-card">
              <div className="trip-info-header">
                <div className="trip-info-title">
                  Trip #{formData.selectedTrip.slNumber} - {formData.selectedTrip.vehicleNumber}
                </div>
                <div className="trip-info-date">{formatDate(formData.selectedTrip.date)}</div>
              </div>
              
              <div className="trip-info-grid">
                <div className="info-item">
                  <span className="info-label">STR Number</span>
                  <span className="info-value">{formData.selectedTrip.strNumber}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Quantity</span>
                  <span className="info-value">{formData.selectedTrip.quantity}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Driver</span>
                  <span className="info-value">{formData.selectedTrip.driverName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Mobile</span>
                  <span className="info-value">{formData.selectedTrip.mobileNumber}</span>
                </div>
              </div>
              
              <div className="villages-info">
                <span className="info-label">Villages:</span>
                <div className="villages-list">
                  {formData.selectedTrip.villages?.map((village, index) => (
                    <span key={`village-${village}-${index}`} className="village-tag">{village}</span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Advance History Section */}
            <div className="advance-history-section">
              <h4>Advance History</h4>
              <div className="advance-summary-card">
                <div className="advance-summary-header">
                  <div className="advance-total">
                    <span className="label">Total Advances:</span>
                    <span className="amount">{formatCurrency(totalAdvancesForTrip)}</span>
                  </div>
                  <div className="advance-count">
                    {getTripAdvanceInfo(formData.selectedTrip.id).count} payment{getTripAdvanceInfo(formData.selectedTrip.id).count > 1 ? 's' : ''}
                  </div>
                </div>
                
                {/* Recent Advances List */}
                {getTripAdvanceInfo(formData.selectedTrip.id).count > 0 && (
                  <div className="recent-advances-list">
                    <h5>Recent Advances</h5>
                    {getTripAdvanceInfo(formData.selectedTrip.id).advances.slice(0, 3).map((advance, index) => (
                      <div key={advance.id || `advance-${index}`} className="recent-advance-item">
                        <div className="advance-amount">{formatCurrency(advance.advanceAmount)}</div>
                        <div className="advance-date">{formatDate(advance.createdAt)}</div>
                        {advance.note && <div className="advance-note">{advance.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Advance Amount */}
        <div className="form-group">
          <label className="form-label">Advance Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            value={formData.advanceAmount}
            onChange={(e) => handleInputChange('advanceAmount', e.target.value)}
            placeholder="Enter advance amount"
            className={`form-input amount-input ${errors.advanceAmount ? 'error' : ''}`}
          />
          {errors.advanceAmount && <span className="error-text">{errors.advanceAmount}</span>}
        </div>

        {/* Note */}
        <div className="form-group">
          <label className="form-label">Note (Optional)</label>
          <textarea
            value={formData.note}
            onChange={(e) => handleInputChange('note', e.target.value)}
            placeholder="Add a note about this advance payment..."
            className="form-input form-textarea"
            rows="3"
          />
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !formData.selectedTrip}
          >
            {loading ? (
              <>
                <div className="loading"></div>
                Adding...
              </>
            ) : (
              <>
                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                Add Advance
              </>
            )}
          </button>
        </div>
      </form>

      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default AddAdvanceForm;
