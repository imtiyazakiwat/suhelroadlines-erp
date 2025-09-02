import React, { useState, useEffect, useRef } from 'react';
import { tripService } from '../../services/firebaseService';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import Toast from '../Common/Toast';
import './SimpleSTRStatus.css';

const SimpleSTRStatus = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Ref for cleanup
  const toastTimeoutRef = useRef(null);
  
  const [filters, setFilters] = useState({
    dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    vehicleNumber: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load trips for the current month by default
      const startDate = new Date(filters.dateFrom);
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      const tripsData = await tripService.getTripsByDateRange(startDate, endDate);
      setTrips(tripsData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToastMessage('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSTRStatusChange = (tripId, newStatus) => {
    setTrips(prevTrips => 
      prevTrips.map(trip => 
        trip.id === tripId 
          ? { ...trip, strStatus: newStatus } 
          : trip
      )
    );
    setHasChanges(true);
  };

  const saveChanges = async () => {
    setUpdating(true);
    
    try {
      // Update each trip with new STR status
      const updatePromises = trips.map(trip => 
        tripService.updateSTRStatus(trip.id, trip.strStatus)
      );
      
      await Promise.all(updatePromises);
      
      showToastMessage('STR status updated successfully!');
      setHasChanges(false);
      
      // Reload data to ensure we have the latest
      await loadData();
    } catch (error) {
      console.error('Error updating STR status:', error);
      showToastMessage('Error updating STR status');
    } finally {
      setUpdating(false);
    }
  };

  const applyFilters = () => {
    loadData();
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      vehicleNumber: ''
    });
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    
    // Clear existing toast timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    // Set new timeout
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'MMM dd, yyyy');
  };

  return (
    <div className="simple-str-status-container">
      {/* Filters Card */}
      <div className="filters-card">
        <div className="card-content">
          <h3>Filters</h3>
          
          <div className="filter-list">
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                type="text"
                placeholder="Filter by vehicle number"
                value={filters.vehicleNumber}
                onChange={(e) => handleFilterChange('vehicleNumber', e.target.value)}
                className="form-input"
              />
            </div>
          </div>
          
          <div className="filter-actions">
            <button 
              className="btn btn-secondary"
              onClick={clearFilters}
            >
              Clear
            </button>
            <button 
              className="btn btn-primary"
              onClick={applyFilters}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* STR Status Management Card */}
      <div className="str-status-card">
        <div className="card-content">
          <div className="str-status-header">
            <h3>STR Status Management</h3>
            <div className="str-status-actions">
              <span className={`badge ${hasChanges ? 'badge-red' : 'badge-gray'}`}>
                {trips.length} trips
              </span>
              <button 
                className="btn btn-primary save-btn"
                onClick={saveChanges}
                disabled={!hasChanges || updating}
              >
                {updating ? (
                  <>
                    <div className="loading-spinner"></div>
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
              <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
              <div className="loading-shimmer" style={{ height: 60 }}></div>
            </div>
          ) : (
            <div className="trips-list">
              {trips.length === 0 ? (
                <div className="no-trips-message">No trips found for the selected filters</div>
              ) : (
                trips.map((trip) => (
                  <div key={trip.id} className="trip-item">
                    <div className="trip-header">
                      <div className="trip-title">
                        <span className="trip-sl">#{trip.slNumber}</span>
                        <span className="trip-vehicle">{trip.vehicleNumber}</span>
                        <span className="trip-date">{formatDate(trip.date)}</span>
                      </div>
                    </div>
                    
                    <div className="str-status-row">
                      <div className="str-label">STR Status:</div>
                      <select
                        value={trip.strStatus || 'not received'}
                        onChange={(e) => handleSTRStatusChange(trip.id, e.target.value)}
                        className={`str-status-select ${(trip.strStatus || 'not received') === 'Received' ? 'received' : 'not-received'}`}
                      >
                        <option value="not received">Not Received</option>
                        <option value="Received">Received</option>
                      </select>
                    </div>
                    
                    <div className="trip-details">
                      <div className="detail-row">
                        <span className="label">STR Number:</span>
                        <span className="value">{trip.strNumber || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Villages:</span>
                        <span className="value">{trip.villages?.join(', ') || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default SimpleSTRStatus;