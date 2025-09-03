import React, { useState, useEffect, useCallback } from 'react';
import { CSVLink } from 'react-csv';
import { tripService, vehicleService, advanceService, villageService } from '../../services/firebaseService';
import { calculateAdvanceTotals, formatCurrency as utilFormatCurrency } from '../../types';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import Toast from '../Common/Toast';
import './ReportsPage.css';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('trips');
  const [filters, setFilters] = useState({
    dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    vehicleNumber: '',
    village: ''
  });
  
  const [data, setData] = useState({
    trips: [],
    advances: [],
    summary: {
      totalTrips: 0,
      totalAdvances: 0,
      totalQuantity: 0,
      uniqueVehicles: 0,
      avgAdvancePerTrip: 0
    }
  });
  
  // eslint-disable-next-line no-unused-vars
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [csvData, setCsvData] = useState([]);
  
  // Edit trip state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [editFormData, setEditFormData] = useState({
    slNumber: '',
    date: '',
    vehicleNumber: '',
    strNumber: '',
    vehicleType: 'lorry',
    villages: [],
    quantity: '',
    driverName: '',
    mobileNumber: '',
    advanceAmount: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      const [vehicleList, villageList] = await Promise.all([
        vehicleService.getAllVehicles(),
        villageService.getAllVillages()
      ]);
      setVehicles(vehicleList);
      // Removed setAllVillages since allVillages state was removed
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }, []);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(filters.dateFrom);
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      
      let trips = await tripService.getTripsByDateRange(startDate, endDate);
      
      // Apply filters
      if (filters.vehicleNumber) {
        trips = trips.filter(trip => 
          trip.vehicleNumber.toLowerCase().includes(filters.vehicleNumber.toLowerCase())
        );
      }
      
      if (filters.village) {
        trips = trips.filter(trip => 
          trip.villages?.some(village => 
            village.toLowerCase().includes(filters.village.toLowerCase())
          )
        );
      }
      
      // Get all advances in the date range for better performance
      const allAdvances = await advanceService.getAdvancesByDateRange(startDate, endDate);
      
      // Group advances by tripId for efficient lookup
      const advancesByTrip = {};
      allAdvances.forEach(advance => {
        const tripId = advance.tripId;
        if (tripId && tripId !== '') {
          if (!advancesByTrip[tripId]) {
            advancesByTrip[tripId] = [];
          }
          advancesByTrip[tripId].push(advance);
        }
      });

      // Load advances for each trip using SIMPLIFIED approach - same as AddAdvanceForm.js
      const tripsWithAdvances = trips.map((trip) => {
        try {
          const advances = advancesByTrip[trip.id] || [];
          
          // Use centralized calculation utility
          const advanceCalc = calculateAdvanceTotals(advances);
          
          // If the trip has an advanceAmount but no initial advance records,
          // create a synthetic initial advance from the trip's advanceAmount
          let initialTotal = advanceCalc.initial;
          let initialAdvances = advanceCalc.initialAdvances;
          
          if (trip.advanceAmount > 0 && initialTotal === 0) {
            // Create a synthetic initial advance from the trip's advanceAmount
            initialTotal = trip.advanceAmount || 0;
            initialAdvances = [{
              id: `trip-${trip.id}`,
              tripId: trip.id,
              vehicleNumber: trip.vehicleNumber,
              tripDate: trip.date,
              advanceAmount: trip.advanceAmount,
              advanceType: 'initial',
              note: 'Initial advance from trip record',
              createdAt: trip.createdAt || new Date()
            }];
          }
          
          // Calculate the new total including the trip's advanceAmount
          const grandTotal = initialTotal + advanceCalc.additional;
          
          console.log(`Trip ${trip.id}: Found ${advances.length} advances, initial: ${initialTotal}, additional: ${advanceCalc.additional}, total: ${grandTotal}`);
          
          return {
            ...trip,
            advances: advances,
            initialAdvances: initialAdvances,
            additionalAdvances: advanceCalc.additionalAdvances,
            initialTotal: initialTotal,
            additionalTotal: advanceCalc.additional,
            totalAdvances: grandTotal,
            advanceCount: advanceCalc.count + (initialAdvances.length > 0 ? 1 : 0)
          };
        } catch (error) {
          console.error(`Error loading advances for trip ${trip.id}:`, error);
          return {
            ...trip,
            advances: [],
            initialAdvances: [],
            additionalAdvances: [],
            initialTotal: trip.advanceAmount || 0, // Use trip's advanceAmount as fallback
            additionalTotal: 0,
            totalAdvances: trip.advanceAmount || 0, // Use trip's advanceAmount as fallback
            advanceCount: trip.advanceAmount > 0 ? 1 : 0
          };
        }
      });
      
      const summary = calculateSummary(tripsWithAdvances);
      
      // Create synthetic initial advances from trip records that don't have advance records
      const syntheticAdvances = tripsWithAdvances
        .filter(trip => trip.advanceAmount > 0 && trip.initialTotal === trip.advanceAmount)
        .map(trip => ({
          id: `trip-${trip.id}`,
          tripId: trip.id,
          vehicleNumber: trip.vehicleNumber,
          tripDate: trip.date,
          advanceAmount: trip.advanceAmount,
          advanceType: 'initial',
          note: 'Initial advance from trip record',
          createdAt: trip.createdAt || new Date()
        }));
      
      // Combine real advances with synthetic advances
      const combinedAdvances = [...allAdvances, ...syntheticAdvances];
      
      setData({
        trips: tripsWithAdvances,
        advances: combinedAdvances,
        summary: summary
      });
      
    } catch (error) {
      console.error('Error loading report data:', error);
      showToastMessage('Error loading report data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const prepareCsvData = useCallback((trips) => {
    const csvRows = trips.map(trip => ({
      'SL Number': trip.slNumber,
      'Date': formatDate(trip.date),
      'Vehicle Number': trip.vehicleNumber,
      'Vehicle Type': trip.vehicleType || 'lorry',
      'STR Number': trip.strNumber,
      'STR Status': trip.strStatus || 'not received',
      'Villages': trip.villages?.join('; ') || '',
      'Quantity': trip.quantity || 0,
      'Driver Name': trip.driverName || '',
      'Mobile Number': trip.mobileNumber || '',
      'Initial Advances Total': trip.initialTotal || 0,
      'Initial Advances Count': trip.initialAdvances?.length || 0,
      'Additional Advances Total': trip.additionalTotal || 0,
      'Additional Advances Count': trip.additionalAdvances?.length || 0,
      'Grand Total Advances': trip.totalAdvances || 0,
      'Total Advance Records': trip.advanceCount || 0
    }));
    setCsvData(csvRows);
  }, []);

  const calculateSummary = (trips) => {
    const totalTrips = trips.length;
    const totalAdvances = trips.reduce((sum, trip) => sum + (trip.totalAdvances || 0), 0);
    const totalQuantity = trips.reduce((sum, trip) => sum + (trip.quantity || 0), 0);
    const uniqueVehicles = new Set(trips.map(trip => trip.vehicleNumber)).size;
    const avgAdvancePerTrip = totalTrips > 0 ? totalAdvances / totalTrips : 0;
    
    return {
      totalTrips,
      totalAdvances,
      totalQuantity,
      uniqueVehicles,
      avgAdvancePerTrip
    };
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Prepare CSV data whenever trips data changes
  useEffect(() => {
    if (data.trips.length > 0) {
      prepareCsvData(data.trips);
    }
  }, [data.trips, prepareCsvData]);

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
      case 'year':
        dateFrom = format(startOfYear(today), 'yyyy-MM-dd');
        dateTo = format(endOfYear(today), 'yyyy-MM-dd');
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

  const clearFilters = () => {
    setFilters({
      dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      vehicleNumber: '',
      village: ''
    });
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Edit trip functions
  const handleEditTrip = (trip) => {
    setEditingTrip(trip);

    // Safely format the date
    let formattedDate = '';
    try {
      if (trip.date) {
        const dateObj = trip.date.toDate ? trip.date.toDate() : new Date(trip.date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = format(dateObj, 'yyyy-MM-dd');
        }
      }
    } catch (error) {
      console.error('Error formatting date:', error);
    }

    setEditFormData({
      slNumber: trip.slNumber,
      date: formattedDate,
      vehicleNumber: trip.vehicleNumber,
      strNumber: trip.strNumber,
      vehicleType: trip.vehicleType || 'lorry',
      villages: trip.villages || [],
      quantity: trip.quantity,
      driverName: trip.driverName,
      mobileNumber: trip.mobileNumber,
      advanceAmount: trip.advanceAmount || 0
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const handleDeleteTrip = async (trip) => {
    if (!window.confirm(`Are you sure you want to delete Trip #${trip.slNumber} (${trip.vehicleNumber})? This action cannot be undone.`)) {
      return;
    }

    try {
      await tripService.deleteTrip(trip.id);
      showToastMessage('Trip deleted successfully!');
      loadReportData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting trip:', error);
      showToastMessage('Error deleting trip. Please try again.');
    }
  };

  const handleEditInputChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (editErrors[field]) {
      setEditErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const removeEditVillage = (villageToRemove) => {
    setEditFormData(prev => ({
      ...prev,
      villages: prev.villages.filter(village => village !== villageToRemove)
    }));
  };

  const validateEditForm = () => {
    const newErrors = {};
    
    if (!editFormData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle number is required';
    }
    
    if (!editFormData.strNumber.trim()) {
      newErrors.strNumber = 'STR number is required';
    }
    
    if (editFormData.villages.length === 0) {
      newErrors.villages = 'At least one village is required';
    }
    
    if (!editFormData.quantity || parseFloat(editFormData.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }
    
    if (!editFormData.driverName.trim()) {
      newErrors.driverName = 'Driver name is required';
    }
    
    if (!editFormData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(editFormData.mobileNumber)) {
      newErrors.mobileNumber = 'Valid 10-digit mobile number is required';
    }
    
    if (editFormData.advanceAmount && parseFloat(editFormData.advanceAmount) < 0) {
      newErrors.advanceAmount = 'Advance amount cannot be negative';
    }
    
    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditSubmit = async () => {
    if (!validateEditForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    setEditLoading(true);
    
    try {
      const newAdvanceAmount = parseFloat(editFormData.advanceAmount) || 0;
      const originalAdvanceAmount = editingTrip.advanceAmount || 0;
      const advanceDifference = newAdvanceAmount - originalAdvanceAmount;
      
      const updateData = {
        slNumber: parseInt(editFormData.slNumber),
        date: new Date(editFormData.date),
        vehicleNumber: editFormData.vehicleNumber.trim(),
        strNumber: editFormData.strNumber.trim(),
        vehicleType: editFormData.vehicleType,
        villages: editFormData.villages,
        quantity: parseFloat(editFormData.quantity),
        driverName: editFormData.driverName.trim(),
        mobileNumber: editFormData.mobileNumber.trim(),
        advanceAmount: newAdvanceAmount
      };
      
      await tripService.updateTrip(editingTrip.id, updateData);
      
      // If the advance amount was increased, create an additional advance record for the difference
      if (advanceDifference > 0) {
        await advanceService.addAdvance({
          tripId: editingTrip.id,
          vehicleNumber: editFormData.vehicleNumber.trim(),
          tripDate: new Date(editFormData.date),
          advanceAmount: advanceDifference,
          advanceType: 'additional',
          note: `Additional advance from trip edit (${formatCurrency(originalAdvanceAmount)} → ${formatCurrency(newAdvanceAmount)})`,
          createdAt: new Date()
        });
      }
      
      // Update vehicle information if changed
      const existingVehicle = vehicles.find(v => v.vehicleNumber === editFormData.vehicleNumber);
      if (!existingVehicle ||
          existingVehicle.driverName !== editFormData.driverName ||
          existingVehicle.mobileNumber !== editFormData.mobileNumber) {
        await vehicleService.addVehicle({
          vehicleNumber: editFormData.vehicleNumber,
          driverName: editFormData.driverName,
          mobileNumber: editFormData.mobileNumber,
          isActive: true
        });
      }
      
      showToastMessage('Trip updated successfully!');
      setShowEditModal(false);
      
      // Refresh the report data
      loadReportData();
      
    } catch (error) {
      console.error('Error updating trip:', error);
      showToastMessage('Error updating trip. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'MMM dd, yyyy');
  };

  const formatCurrency = (amount) => {
    return utilFormatCurrency(amount);
  };

  const csvHeaders = [
    { label: 'SL Number', key: 'SL Number' },
    { label: 'Date', key: 'Date' },
    { label: 'Vehicle Number', key: 'Vehicle Number' },
    { label: 'Vehicle Type', key: 'Vehicle Type' },
    { label: 'STR Number', key: 'STR Number' },
    { label: 'STR Status', key: 'STR Status' },
    { label: 'Villages', key: 'Villages' },
    { label: 'Quantity', key: 'Quantity' },
    { label: 'Driver Name', key: 'Driver Name' },
    { label: 'Mobile Number', key: 'Mobile Number' },
    { label: 'Initial Advances Total', key: 'Initial Advances Total' },
    { label: 'Initial Advances Count', key: 'Initial Advances Count' },
    { label: 'Additional Advances Total', key: 'Additional Advances Total' },
    { label: 'Additional Advances Count', key: 'Additional Advances Count' },
    { label: 'Grand Total Advances', key: 'Grand Total Advances' },
    { label: 'Total Advance Records', key: 'Total Advance Records' }
  ];

  const csvFilename = `SuhelRoadline_Report_${filters.dateFrom}_to_${filters.dateTo}.csv`;

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
        <p className="page-subtitle">Comprehensive insights into your travel operations</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-header">
          <h2>Filters</h2>
          <div className="filter-actions">
            <button onClick={clearFilters} className="btn btn-ghost btn-sm">
              Clear All
            </button>
            <CSVLink
              data={csvData}
              headers={csvHeaders}
              filename={csvFilename}
              className="btn btn-primary btn-sm"
              onClick={() => showToastMessage('Report exported successfully!')}
            >
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export CSV
            </CSVLink>
          </div>
        </div>
        
        {/* Quick Filters */}
        <div className="quick-filters">
          <button 
            className="quick-filter-btn"
            onClick={() => setQuickDateFilter('today')}
          >
            Today
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => setQuickDateFilter('week')}
          >
            Last 7 Days
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => setQuickDateFilter('month')}
          >
            This Month
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => setQuickDateFilter('year')}
          >
            This Year
          </button>
        </div>
        
        {/* Filter Form */}
        <div className="filter-form">
          <div className="filter-row">
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
          </div>
          
          <div className="filter-row">
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                type="text"
                value={filters.vehicleNumber}
                onChange={(e) => handleFilterChange('vehicleNumber', e.target.value)}
                placeholder="Filter by vehicle number"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Village</label>
              <input
                type="text"
                value={filters.village}
                onChange={(e) => handleFilterChange('village', e.target.value)}
                placeholder="Filter by village name"
                className="form-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-section">
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
              </svg>
            </div>
            <div className="summary-value">{data.summary.totalTrips}</div>
            <div className="summary-label">Total Trips</div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div className="summary-value">{formatCurrency(data.summary.totalAdvances)}</div>
            <div className="summary-label">Total Advances</div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </div>
            <div className="summary-value">{data.summary.totalQuantity}</div>
            <div className="summary-label">Total Quantity</div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
              </svg>
            </div>
            <div className="summary-value">{data.summary.uniqueVehicles}</div>
            <div className="summary-label">Unique Vehicles</div>
          </div>
        </div>
      </div>

      {/* Data Tabs */}
      <div className="data-section">
        <div className="tab-header">
          <div className="tab-buttons">
            <button 
              className={`tab-btn ${activeTab === 'trips' ? 'active' : ''}`}
              onClick={() => setActiveTab('trips')}
            >
              Trips ({data.trips.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'advances' ? 'active' : ''}`}
              onClick={() => setActiveTab('advances')}
            >
              Advances ({data.advances.length})
            </button>
          </div>
        </div>
        
        <div className="tab-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading"></div>
              <p>Loading data...</p>
            </div>
          ) : activeTab === 'trips' ? (
            <div className="trips-table-container">
              {data.trips.length === 0 ? (
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
                <div className="table-responsive">
                  <table className="trips-table">
                    <thead>
                      <tr>
                        <th className="col-sl">SL</th>
                        <th className="col-date">Date</th>
                        <th className="col-vehicle">Vehicle</th>
                        <th className="col-type">Type</th>
                        <th className="col-str">STR Status</th>
                        <th className="col-villages">Villages</th>
                        <th className="col-quantity">Quantity</th>
                        <th className="col-driver">Driver</th>
                        <th className="col-advances">Advances</th>
                        <th className="col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trips.map((trip) => (
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
                          <td className="col-type">{trip.vehicleType || 'lorry'}</td>
                          <td className="col-str">
                            <span className={`str-status-badge ${trip.strStatus === 'Received' ? 'received' : 'not-received'}`}>
                              {trip.strStatus || 'not received'}
                            </span>
                          </td>
                          <td className="col-villages">
                            <div className="villages-cell">
                              {trip.villages?.map((village, index) => (
                                <span key={index} className="village-chip">{village}</span>
                              ))}
                            </div>
                          </td>
                          <td className="col-quantity">{trip.quantity || '-'}</td>
                          <td className="col-driver">{trip.driverName || '-'}</td>
                          <td className="col-advances">
                            <div className="advances-info">
                              <span className="advance-amount">{formatCurrency(trip.advanceAmount || 0)}</span>
                              {trip.advanceCount > 0 && (
                                <span className="advance-count">({trip.advanceCount})</span>
                              )}
                            </div>
                          </td>
                          <td className="col-actions">
                            <div className="row-actions">
                              <button
                                className="btn-icon edit-trip-btn"
                                onClick={() => handleEditTrip(trip)}
                                title="Edit Trip"
                              >
                                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                              <button
                                className="btn-icon delete-trip-btn"
                                onClick={() => handleDeleteTrip(trip)}
                                title="Delete Trip"
                              >
                                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path d="M3 6h18"></path>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 0 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="advances-list">
              {data.advances.length === 0 ? (
                <div className="empty-state">
                  <svg className="icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <h3>No advances found</h3>
                  <p>Try adjusting your filters to see more results</p>
                </div>
              ) : (
                data.advances.map((advance) => (
                  <div key={advance.id} className="advance-item">
                    <div className="advance-header">
                      <div className="advance-info">
                        <span className="advance-vehicle">{advance.vehicleNumber}</span>
                        <span className="advance-amount">{formatCurrency(advance.advanceAmount)}</span>
                        <span className={`advance-type-badge ${advance.advanceType || 'additional'}`}>
                          {advance.advanceType === 'initial' ? 'Initial' : 'Additional'}
                        </span>
                      </div>
                      <span className="advance-date">{formatDate(advance.createdAt)}</span>
                    </div>
                    <div className="advance-details">
                      <div className="detail-row">
                        <span className="detail-label">Trip Date:</span>
                        <span className="detail-value">{formatDate(advance.tripDate)}</span>
                      </div>
                      {advance.note && (
                        <div className="detail-row">
                          <span className="detail-label">Note:</span>
                          <span className="detail-value">{advance.note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Trip Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Edit Trip</h2>
              <button
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">SL Number</label>
                <input
                  type="text"
                  value={editFormData.slNumber}
                  onChange={(e) => handleEditInputChange('slNumber', e.target.value)}
                  className={`form-input ${editErrors.slNumber ? 'error' : ''}`}
                />
                {editErrors.slNumber && <span className="error-text">{editErrors.slNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => handleEditInputChange('date', e.target.value)}
                  className={`form-input ${editErrors.date ? 'error' : ''}`}
                />
                {editErrors.date && <span className="error-text">{editErrors.date}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle Number</label>
                <input
                  type="text"
                  value={editFormData.vehicleNumber}
                  onChange={(e) => handleEditInputChange('vehicleNumber', e.target.value)}
                  className={`form-input ${editErrors.vehicleNumber ? 'error' : ''}`}
                />
                {editErrors.vehicleNumber && <span className="error-text">{editErrors.vehicleNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle Type</label>
                <select
                  value={editFormData.vehicleType}
                  onChange={(e) => handleEditInputChange('vehicleType', e.target.value)}
                  className={`form-input ${editErrors.vehicleType ? 'error' : ''}`}
                >
                  <option value="lorry">Lorry</option>
                  <option value="tempo">Tempo</option>
                  <option value="pickup">Pickup</option>
                </select>
                {editErrors.vehicleType && <span className="error-text">{editErrors.vehicleType}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">STR Status</label>
                <select
                  value={editFormData.strNumber}
                  onChange={(e) => handleEditInputChange('strNumber', e.target.value)}
                  className={`form-input ${editErrors.strNumber ? 'error' : ''}`}
                >
                  <option value="not received">Not Received</option>
                  <option value="Received">Received</option>
                </select>
                {editErrors.strNumber && <span className="error-text">{editErrors.strNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Villages</label>
                <div className="villages-container">
                  {editFormData.villages.length > 0 && (
                    <div className="selected-villages">
                      {editFormData.villages.map((village, index) => (
                        <span key={index} className="village-chip">
                          {village}
                          <button
                            type="button"
                            onClick={() => removeEditVillage(village)}
                            className="remove-chip"
                          >
                            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {editFormData.villages.length === 0 && (
                    <span className="no-villages">No villages selected</span>
                  )}
                </div>
                {editErrors.villages && <span className="error-text">{editErrors.villages}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.quantity}
                  onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                  className={`form-input ${editErrors.quantity ? 'error' : ''}`}
                />
                {editErrors.quantity && <span className="error-text">{editErrors.quantity}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Driver Name</label>
                <input
                  type="text"
                  value={editFormData.driverName}
                  onChange={(e) => handleEditInputChange('driverName', e.target.value)}
                  className={`form-input ${editErrors.driverName ? 'error' : ''}`}
                />
                {editErrors.driverName && <span className="error-text">{editErrors.driverName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  value={editFormData.mobileNumber}
                  onChange={(e) => handleEditInputChange('mobileNumber', e.target.value)}
                  className={`form-input ${editErrors.mobileNumber ? 'error' : ''}`}
                />
                {editErrors.mobileNumber && <span className="error-text">{editErrors.mobileNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Advance Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.advanceAmount}
                  onChange={(e) => handleEditInputChange('advanceAmount', e.target.value)}
                  className={`form-input ${editErrors.advanceAmount ? 'error' : ''}`}
                />
                {editErrors.advanceAmount && <span className="error-text">{editErrors.advanceAmount}</span>}
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowEditModal(false)}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEditSubmit}
                disabled={editLoading}
              >
                {editLoading ? (
                  <>
                    <div className="loading"></div>
                    Updating...
                  </>
                ) : (
                  'Update Trip'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default ReportsPage;
