import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  }, [filters.dateFrom, filters.dateTo]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadData = useCallback(async () => {
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
  }, [filters.dateFrom, filters.dateTo]);

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
            <div className="table-responsive">
              {trips.length === 0 ? (
                <div className="empty-state">
                  <svg className="icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
                    <line x1="8" y1="1" x2="8" y2="4"></line>
                    <line x1="16" y1="1" x2="16" y2="4"></line>
                  </svg>
                  <h3>No trips found</h3>
                  <p>Try adjusting your filters to see more results</p>
                </div>
              ) : (
                <table className="str-status-table">
                  <thead>
                    <tr>
                      <th className="col-sl">SL</th>
                      <th className="col-date">Date</th>
                      <th className="col-vehicle">Vehicle & Driver</th>
                      <th className="col-str-status">STR Status</th>
                      <th className="col-actions">Quick Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id}>
                        <td className="col-sl">
                          <span className="sl-number">#{trip.slNumber}</span>
                        </td>
                        <td className="col-date">{formatDate(trip.date)}</td>
                        <td className="col-vehicle">
                          <div className="vehicle-info">
                            <span className="vehicle-number">{trip.vehicleNumber}</span>
                            {trip.driverName && (
                              <span className="driver-name">• {trip.driverName}</span>
                            )}
                          </div>
                        </td>
                        <td className="col-str-status">
                          <select
                            value={trip.strStatus || 'not received'}
                            onChange={(e) => handleSTRStatusChange(trip.id, e.target.value)}
                            className={`str-status-select ${(trip.strStatus || 'not received') === 'Received' ? 'received' : 'not-received'}`}
                          >
                            <option value="not received">Not Received</option>
                            <option value="Received">Received</option>
                          </select>
                        </td>
                        <td className="col-actions">
                          <div className="status-indicator">
                            {trip.strStatus === 'Received' ? (
                              <span className="status-dot received" title="STR Received"></span>
                            ) : (
                              <span className="status-dot pending" title="STR Pending"></span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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