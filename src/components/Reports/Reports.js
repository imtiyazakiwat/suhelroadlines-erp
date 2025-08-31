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
  Segmented,
  Tab,
  Tabs,

  Actions,
  ActionsGroup,
  ActionsButton,
  Badge
} from 'framework7-react';
import Toast from '../Common/Toast';
import { CSVLink } from 'react-csv';
import { tripService, vehicleService, advanceService } from '../../services/firebaseService';
import { calculateAdvanceTotals, formatCurrency as utilFormatCurrency } from '../../types';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import './Reports.css';

const Reports = () => {
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
  const [showExportActions, setShowExportActions] = useState(false);
  const [csvData, setCsvData] = useState([]);

  const prepareCsvData = React.useCallback((trips) => {
    const csvRows = trips.map(trip => ({
      'SL Number': trip.slNumber,
      'Date': formatDate(trip.date),
      'Vehicle Number': trip.vehicleNumber,
      'STR Number': trip.strNumber,
      'Villages': trip.villages?.join('; ') || '',
      'Quantity': trip.quantity || 0,
      'Driver Name': trip.driverName || '',
      'Mobile Number': trip.mobileNumber || '',
      'Trip Advance Amount': trip.advanceAmount || 0,
      'Additional Advances Count': trip.advanceCount || 0,
      'Additional Advances Total': trip.totalAdvances || 0,
      'Grand Total Advances': (trip.advanceAmount || 0) + (trip.totalAdvances || 0)
    }));
    setCsvData(csvRows);
  }, []);

  const loadReportData = React.useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(filters.dateFrom);
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      // Load trips data
      let trips = await tripService.getTripsByDateRange(startDate, endDate);
      
      // Apply vehicle filter
      if (filters.vehicleNumber) {
        trips = trips.filter(trip => 
          trip.vehicleNumber.toLowerCase().includes(filters.vehicleNumber.toLowerCase())
        );
      }
      
      // Apply village filter
      if (filters.village) {
        trips = trips.filter(trip => 
          trip.villages?.some(village => 
            village.toLowerCase().includes(filters.village.toLowerCase())
          )
        );
      }
      
      // Load advances for each trip
      const tripsWithAdvances = await Promise.all(
        trips.map(async (trip) => {
          try {
            const advances = await advanceService.getAdvancesByTrip(trip.id);
            const advanceCalc = calculateAdvanceTotals(advances);
            return {
              ...trip,
              advances: advances,
              totalAdvances: advanceCalc.total,
              advanceCount: advanceCalc.count
            };
          } catch (error) {
            console.error(`Error loading advances for trip ${trip.id}:`, error);
            return {
              ...trip,
              advances: [],
              totalAdvances: 0,
              advanceCount: 0
            };
          }
        })
      );
      
      // Calculate summary
      const summary = calculateSummary(tripsWithAdvances);
      
      setData({
        trips: tripsWithAdvances,
        advances: tripsWithAdvances.flatMap(trip => trip.advances || []),
        summary: summary
      });
      
      // Prepare CSV data
      prepareCsvData(tripsWithAdvances);
      
    } catch (error) {
      console.error('Error loading report data:', error);
      showToastMessage('Error loading report data');
    } finally {
      setLoading(false);
    }
  }, [filters, prepareCsvData]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const loadInitialData = async () => {
    try {
      const [vehicleList] = await Promise.all([
        vehicleService.getAllVehicles()
      ]);
      setVehicles(vehicleList);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };



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
    { label: 'Trip Advance Amount', key: 'Trip Advance Amount' },
    { label: 'Additional Advances Count', key: 'Additional Advances Count' },
    { label: 'Additional Advances Total', key: 'Additional Advances Total' },
    { label: 'Grand Total Advances', key: 'Grand Total Advances' }
  ];

  const csvFilename = `SuhelRoadline_Report_${filters.dateFrom}_to_${filters.dateTo}.csv`;

  return (
    <Block className="reports-container">
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
            <Button 
              className="quick-filter-btn"
              onClick={() => setQuickDateFilter('year')}
            >
              This Year
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
            
            <ListInput
              label="Village"
              type="text"
              placeholder="Filter by village name"
              value={filters.village}
              onChange={(e) => handleFilterChange('village', e.target.value)}
              clearButton
            />
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
              onClick={() => setShowExportActions(true)}
              disabled={data.trips.length === 0}
            >
              <Icon ios="f7:square_arrow_up" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="summary-card gradient-card">
        <CardContent>
          <h3>Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-value">{data.summary.totalTrips}</div>
              <div className="summary-label">Total Trips</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{formatCurrency(data.summary.totalAdvances)}</div>
              <div className="summary-label">Total Advances</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{data.summary.totalQuantity}</div>
              <div className="summary-label">Total Quantity</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{data.summary.uniqueVehicles}</div>
              <div className="summary-label">Unique Vehicles</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Tabs */}
      <Card className="data-card">
        <CardContent>
          <Segmented>
            <Button 
              segmentedActive={activeTab === 'trips'}
              onClick={() => setActiveTab('trips')}
            >
              Trips ({data.trips.length})
            </Button>
            <Button 
              segmentedActive={activeTab === 'advances'}
              onClick={() => setActiveTab('advances')}
            >
              Advances ({data.advances.length})
            </Button>
          </Segmented>
          
          <Tabs>
            <Tab tabActive={activeTab === 'trips'}>
              {loading ? (
                <div className="loading-container">
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60 }}></div>
                </div>
              ) : (
                <List className="data-list">
                  {data.trips.length === 0 ? (
                    <ListItem title="No trips found for the selected filters" disabled />
                  ) : (
                    data.trips.map((trip) => (
                      <ListItem key={trip.id} className="trip-item">
                        <div className="trip-header">
                          <div className="trip-title">
                            <span className="trip-sl">#{trip.slNumber}</span>
                            <span className="trip-vehicle">{trip.vehicleNumber}</span>
                            <span className="trip-date">{formatDate(trip.date)}</span>
                          </div>
                          {trip.advanceCount > 0 && (
                            <Badge color="orange">{trip.advanceCount} advances</Badge>
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
                          <div className="detail-row">
                            <span className="label">Driver:</span>
                            <span className="value">{trip.driverName} • {trip.mobileNumber}</span>
                          </div>
                          <div className="detail-row">
                            <span className="label">Total Advances:</span>
                            <span className="value advance-amount">
                              {formatCurrency((trip.advanceAmount || 0) + (trip.totalAdvances || 0))}
                            </span>
                          </div>
                        </div>
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Tab>
            
            <Tab tabActive={activeTab === 'advances'}>
              {loading ? (
                <div className="loading-container">
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60 }}></div>
                </div>
              ) : (
                <List className="data-list">
                  {data.advances.length === 0 ? (
                    <ListItem title="No advances found for the selected filters" disabled />
                  ) : (
                    data.advances.map((advance) => (
                      <ListItem key={advance.id} className="advance-item">
                        <div className="advance-header">
                          <div className="advance-title">
                            <span className="advance-vehicle">{advance.vehicleNumber}</span>
                            <span className="advance-amount">{formatCurrency(advance.advanceAmount)}</span>
                          </div>
                          <span className="advance-date">{formatDate(advance.createdAt)}</span>
                        </div>
                        <div className="advance-details">
                          <div className="detail-row">
                            <span className="label">Trip Date:</span>
                            <span className="value">{formatDate(advance.tripDate)}</span>
                          </div>
                          {advance.note && (
                            <div className="detail-row">
                              <span className="label">Note:</span>
                              <span className="value">{advance.note}</span>
                            </div>
                          )}
                        </div>
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Tab>
          </Tabs>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Actions opened={showExportActions} onActionsClosed={() => setShowExportActions(false)}>
        <ActionsGroup>
          <CSVLink
            data={csvData}
            headers={csvHeaders}
            filename={csvFilename}
            style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
          >
            <ActionsButton onClick={() => setShowExportActions(false)}>
              <Icon ios="f7:doc_text" />
              Export as CSV
            </ActionsButton>
          </CSVLink>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setShowExportActions(false)}>
            Cancel
          </ActionsButton>
        </ActionsGroup>
      </Actions>

      {/* Toast */}
      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </Block>
  );
};

export default Reports;
