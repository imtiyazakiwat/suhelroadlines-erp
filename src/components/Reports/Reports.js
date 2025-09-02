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
  Badge,
  Popup,
  Page,
  Navbar,
  NavRight,
  Link,
  Chip
} from 'framework7-react';
import Toast from '../Common/Toast';
import { CSVLink } from 'react-csv';
import { tripService, vehicleService, advanceService, villageService } from '../../services/firebaseService';
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
  const [allVillages, setAllVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showExportActions, setShowExportActions] = useState(false);
  const [csvData, setCsvData] = useState([]);
  
  // Edit trip state
  const [showEditPopup, setShowEditPopup] = useState(false);
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

  const prepareCsvData = React.useCallback((trips) => {
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
              initialTotal: trip.advanceAmount || 0,
              additionalTotal: 0,
              totalAdvances: trip.advanceAmount || 0,
              advanceCount: trip.advanceAmount > 0 ? 1 : 0
            };
          }
        })
      );
      
      // Calculate summary
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
      const realAdvances = tripsWithAdvances.flatMap(trip => trip.advances || []);
      const combinedAdvances = [...realAdvances, ...syntheticAdvances];
      
      setData({
        trips: tripsWithAdvances,
        advances: combinedAdvances,
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
      const [vehicleList, villageList] = await Promise.all([
        vehicleService.getAllVehicles(),
        villageService.getAllVillages()
      ]);
      setVehicles(vehicleList);
      setAllVillages(villageList);
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

  // Edit trip functions
  const handleEditTrip = (trip) => {
    console.log('Editing trip:', trip);
    console.log('Vehicle type:', trip.vehicleType);
    console.log('STR status:', trip.strStatus);
    
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
    setShowEditPopup(true);
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

  const handleEditVillageSelect = (village) => {
    if (!editFormData.villages.includes(village.villageName)) {
      setEditFormData(prev => ({
        ...prev,
        villages: [...prev.villages, village.villageName]
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
      setShowEditPopup(false);
      
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
                          <div className="trip-actions">
                            {trip.advanceCount > 0 && (
                              <Badge color="orange">{trip.advanceCount} advances</Badge>
                            )}
                            <Button
                              className="str-status-btn"
                              onClick={() => handleEditTrip(trip)}
                            >
                              <Icon ios="f7:doc_text" />
                            </Button>
                            <Button
                              className="edit-trip-btn"
                              onClick={() => handleEditTrip(trip)}
                            >
                              <Icon ios="f7:pencil" />
                            </Button>
                          </div>
                        </div>
                        <div className="trip-details">
                          <div className="detail-row">
                            <span className="label">STR:</span>
                            <span className="value">{trip.strNumber}</span>
                            <span className="str-status">{trip.strStatus || 'not received'}</span>
                          </div>
                          <div className="detail-row">
                            <span className="label">Vehicle Type:</span>
                            <span className="value">{trip.vehicleType || 'lorry'}</span>
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
                              {formatCurrency(trip.advanceAmount || 0)}
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

      {/* Edit Trip Popup */}
      <Popup className="edit-trip-popup" opened={showEditPopup} onPopupClosed={() => setShowEditPopup(false)}>
        <Page>
          <Navbar title="Edit Trip">
            <NavRight>
              <Link onClick={() => setShowEditPopup(false)}>Close</Link>
            </NavRight>
          </Navbar>
          
          <Block>
            <List className="form-list">
              {/* SL Number */}
              <ListInput
                label="SL Number"
                type="text"
                value={editFormData.slNumber}
                onChange={(e) => handleEditInputChange('slNumber', e.target.value)}
                errorMessage={editErrors.slNumber}
                errorMessageForce={!!editErrors.slNumber}
              />
              
              {/* Date */}
              <ListInput
                label="Date"
                type="date"
                value={editFormData.date}
                onChange={(e) => handleEditInputChange('date', e.target.value)}
                errorMessage={editErrors.date}
                errorMessageForce={!!editErrors.date}
              />
              
              {/* Vehicle Number */}
              <ListInput
                label="Vehicle Number"
                type="text"
                value={editFormData.vehicleNumber}
                onChange={(e) => handleEditInputChange('vehicleNumber', e.target.value)}
                errorMessage={editErrors.vehicleNumber}
                errorMessageForce={!!editErrors.vehicleNumber}
              />
              
              {/* Vehicle Type */}
              <ListItem className="vehicle-type-section">
                <div className="vehicle-type-label">Vehicle Type</div>
                <select
                  value={editFormData.vehicleType}
                  onChange={(e) => handleEditInputChange('vehicleType', e.target.value)}
                  className={`form-input ${editErrors.vehicleType ? 'error' : ''}`}
                >
                  <option value="lorry">Lorry</option>
                  <option value="tempo">Tempo</option>
                  <option value="pickup">Pickup</option>
                </select>
                {editErrors.vehicleType && (
                  <div className="error-message">{editErrors.vehicleType}</div>
                )}
              </ListItem>
              
              {/* STR Number */}
              <ListItem className="str-number-section">
                <div className="str-label">STR Status</div>
                <select
                  value={editFormData.strNumber}
                  onChange={(e) => handleEditInputChange('strNumber', e.target.value)}
                  className={`form-input ${editErrors.strNumber ? 'error' : ''}`}
                >
                  <option value="not received">Not Received</option>
                  <option value="Received">Received</option>
                </select>
                {editErrors.strNumber && (
                  <div className="error-message">{editErrors.strNumber}</div>
                )}
              </ListItem>
              
              {/* Villages */}
              <ListItem className="villages-section">
                <div className="villages-header">
                  <span className="villages-label">Villages</span>
                </div>
                <div className="villages-chips">
                  {editFormData.villages.map((village, index) => (
                    <Chip
                      key={index}
                      text={village}
                      deleteable
                      onDelete={() => removeEditVillage(village)}
                      className="village-chip"
                    />
                  ))}
                  {editFormData.villages.length === 0 && (
                    <span className="no-villages">No villages selected</span>
                  )}
                </div>
                {editErrors.villages && (
                  <div className="error-message">{editErrors.villages}</div>
                )}
              </ListItem>
              
              {/* Quantity */}
              <ListInput
                label="Quantity"
                type="number"
                value={editFormData.quantity}
                onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                errorMessage={editErrors.quantity}
                errorMessageForce={!!editErrors.quantity}
              />
              
              {/* Driver Name */}
              <ListInput
                label="Driver Name"
                type="text"
                value={editFormData.driverName}
                onChange={(e) => handleEditInputChange('driverName', e.target.value)}
                errorMessage={editErrors.driverName}
                errorMessageForce={!!editErrors.driverName}
              />
              
              {/* Mobile Number */}
              <ListInput
                label="Mobile Number"
                type="tel"
                value={editFormData.mobileNumber}
                onChange={(e) => handleEditInputChange('mobileNumber', e.target.value)}
                errorMessage={editErrors.mobileNumber}
                errorMessageForce={!!editErrors.mobileNumber}
              />
              
              {/* Advance Amount */}
              <ListInput
                label="Advance Amount (₹)"
                type="number"
                value={editFormData.advanceAmount}
                onChange={(e) => handleEditInputChange('advanceAmount', e.target.value)}
                errorMessage={editErrors.advanceAmount}
                errorMessageForce={!!editErrors.advanceAmount}
              />
            </List>
            
            <div className="form-actions">
              <Button
                className="btn-secondary"
                onClick={() => setShowEditPopup(false)}
              >
                Cancel
              </Button>
              <Button
                className="btn-primary"
                onClick={handleEditSubmit}
                preloader
                loading={editLoading}
              >
                Update Trip
              </Button>
            </div>
          </Block>
        </Page>
      </Popup>

      {/* Toast */}
      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </Block>
  );
};

export default Reports;
