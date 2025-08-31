import React, { useState, useEffect, useCallback } from 'react';
import { CSVLink } from 'react-csv';
import { tripService, vehicleService, advanceService } from '../../services/firebaseService';
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

  const loadInitialData = useCallback(async () => {
    try {
      const [vehicleList] = await Promise.all([
        vehicleService.getAllVehicles()
      ]);
      setVehicles(vehicleList);
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
          
          console.log(`Trip ${trip.id}: Found ${advances.length} advances, total: ${advanceCalc.total}`);
          
          return {
            ...trip,
            advances: advances,
            initialAdvances: advanceCalc.initialAdvances,
            additionalAdvances: advanceCalc.additionalAdvances,
            initialTotal: advanceCalc.initial,
            additionalTotal: advanceCalc.additional,
            totalAdvances: advanceCalc.total, // Use centralized calculation
            advanceCount: advanceCalc.count
          };
        } catch (error) {
          console.error(`Error loading advances for trip ${trip.id}:`, error);
          return {
            ...trip,
            advances: [],
            initialAdvances: [],
            additionalAdvances: [],
            initialTotal: 0,
            additionalTotal: 0,
            totalAdvances: 0,
            advanceCount: 0
          };
        }
      });
      
      const summary = calculateSummary(tripsWithAdvances);
      
      setData({
        trips: tripsWithAdvances,
        advances: allAdvances, // Use all advances from the date range
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
      'STR Number': trip.strNumber,
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
    { label: 'STR Number', key: 'STR Number' },
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
            <div className="trips-list">
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
                data.trips.map((trip) => (
                  <div key={trip.id} className="trip-item">
                    <div className="trip-header">
                      <div className="trip-info">
                        <span className="trip-sl">#{trip.slNumber}</span>
                        <span className="trip-vehicle">{trip.vehicleNumber}</span>
                        <span className="trip-date">{formatDate(trip.date)}</span>
                      </div>
                      {trip.advanceCount > 0 && (
                        <div className="advance-badge">
                          {trip.advanceCount} advance{trip.advanceCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="trip-details">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">STR</span>
                          <span className="detail-value">{trip.strNumber}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Quantity</span>
                          <span className="detail-value">{trip.quantity}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Driver</span>
                          <span className="detail-value">{trip.driverName}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Total Advances</span>
                          <span className="detail-value advance-amount">
                            {formatCurrency(trip.totalAdvances || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="villages-row">
                        <span className="detail-label">Villages:</span>
                        <div className="villages-list">
                          {trip.villages?.map((village, index) => (
                            <span key={index} className="village-tag">{village}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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

      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default ReportsPage;
