
import React, { useState, useEffect } from 'react';
import {
  Block,
  Card,
  CardContent,
  List,
  ListInput,
  ListItem,
  Button,
  Icon,
  Select,
  Row,
  Col,
  Badge
} from 'framework7-react';
import { tripService, vehicleService } from '../../services/firebaseService';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import Toast from '../Common/Toast';
import './STRStatus.css';

const STRStatus = () => {
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [filters, setFilters] = useState({
    dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    vehicleNumber: '',
    strStatus: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trips, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load trips for the current month by default
      const startDate = new Date(filters.dateFrom);
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      const tripsData = await tripService.getTripsByDateRange(startDate, endDate);
      setTrips(tripsData);
      
      // Load vehicles for filtering
      const vehiclesData = await vehicleService.getAllVehicles();
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToastMessage('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...trips];
    
    // Apply vehicle filter
    if (filters.vehicleNumber) {
      result = result.filter(trip => 
        trip.vehicleNumber.toLowerCase().includes(filters.vehicleNumber.toLowerCase())
      );
    }
    
    // Apply STR status filter
    if (filters.strStatus) {
      result = result.filter(trip => 
        (trip.strStatus || 'not received') === filters.strStatus
      );
    }
    
    setFilteredTrips(result);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const setQuickDateFilter = (type) => {
    const today = new Date();
    let dateFrom, dateTo;
    
    switch (type) {
      case 'today':
        dateFrom = dateTo = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        dateFrom = format(subDays(today, 7), 'yyyy-MM-dd');
        dateTo = format(today, 'yyyy-MM-dd');
        break;
      case 'month':
        dateFrom = format(startOfMonth(today), 'yyyy-MM-dd');
        dateTo = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      default:
        return;
    }
    
    setFilters(prev => ({
      ...prev,
      dateFrom,
      dateTo
    }));
  };

  const handleSTRStatusChange = (tripId, newStatus) => {
    console.log(`STR status changed for trip ${tripId} to:`, newStatus);
    
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
      // Find all trips with changed STR status
      const changedTrips = trips.filter(trip => {
        const originalTrip = filteredTrips.find(t => t.id === trip.id);
        return originalTrip && originalTrip.strStatus !== trip.strStatus;
      });
      
      console.log('Trips with changed STR status:', changedTrips);
      
      // Update each trip with new STR status
      const updatePromises = changedTrips.map(trip =>
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

  const clearFilters = () => {
    setFilters({
      dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      vehicleNumber: '',
      strStatus: ''
    });
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'MMM dd, yyyy');
  };

  return (
    <Block className="str-status-container">
      {/* Filters Card */}
      <Card className="filters-card">
        <CardContent>
          <h3>Filters</h3>
          
          {/* Quick Date Filters */}
          <div className="quick-filters">
            <Button
              className="quick-filter-btn"
              onClick={() => setQuickDateFilter('today')}
            >
              Today
            </Button>
            <Button
              className="quick-filter-btn"
              onClick={() => setQuickDateFilter('week')}
            >
              Last 7 Days
            </Button>
            <Button
              className="quick-filter-btn"
              onClick={() => setQuickDateFilter('month')}
            >
              This Month
            </Button>
          </div>
          
          <List className="filter-list">
            <ListInput
              label="From Date"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
            
            <ListInput
              label="To Date"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
            
            <ListInput
              label="Vehicle Number"
              type="text"
              placeholder="Filter by vehicle number"
              value={filters.vehicleNumber}
              onChange={(e) => handleFilterChange('vehicleNumber', e.target.value)}
              clearButton
            />
            
            <ListItem className="filter-select-item" title="STR Status">
              <Select
                value={filters.strStatus}
                onChange={(e) => handleFilterChange('strStatus', e.target.value)}
                placeholder="All"
              >
                <option value="">All</option>
                <option value="not received">Not Received</option>
                <option value="Received">Received</option>
              </Select>
            </ListItem>
          </List>
          
          <div className="filter-actions">
            <Button
              className="btn-secondary"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
            <Button
              className="btn-primary"
              onClick={loadData}
            >
              <Icon ios="f7:arrow_clockwise" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* STR Status Management Card */}
      <Card className="str-status-card">
        <CardContent>
          <div className="str-status-header">
            <h3>STR Status Management</h3>
            <div className="str-status-actions">
              <Badge color={hasChanges ? "red" : "gray"}>
                {filteredTrips.length} trips
              </Badge>
              <Button
                className="btn-primary save-btn"
                onClick={saveChanges}
                disabled={!hasChanges || updating}
                preloader
                loading={updating}
              >
                Save Changes
              </Button>
            </div>
          </div>
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-shimmer" style={{ height: 80, marginBottom: 8 }}></div>
              <div className="loading-shimmer" style={{ height: 80, marginBottom: 8 }}></div>
              <div className="loading-shimmer" style={{ height: 80 }}></div>
            </div>
          ) : (
            <List className="trips-list">
              {filteredTrips.length === 0 ? (
                <ListItem title="No trips found for the selected filters" disabled />
              ) : (
                filteredTrips.map((trip) => (
                  <ListItem key={trip.id} className="trip-item">
                    <div className="trip-header">
                      <div className="trip-title">
                        <span className="trip-sl">#{trip.slNumber}</span>
                        <span className="trip-vehicle">{trip.vehicleNumber}</span>
                        <span className="trip-date">{formatDate(trip.date)}</span>
                      </div>
                      <div className="trip-info">
                        <span className="trip-villages">{trip.villages?.join(', ') || 'N/A'}</span>
                        <span className="trip-quantity">Qty: {trip.quantity}</span>
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
                        <span className="label">Vehicle Type:</span>
                        <span className="value">{trip.vehicleType || 'lorry'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Driver:</span>
                        <span className="value">{trip.driverName || 'N/A'}</span>
                      </div>
                    </div>
                  </ListItem>
                ))
              )}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Toast */}
      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </Block>
  );
};

export default STRStatus;
