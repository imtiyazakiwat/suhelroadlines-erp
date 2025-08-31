import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, villageService } from '../../services/firebaseService';
import { createTripEntry } from '../../types';
import { format } from 'date-fns';
import Toast from '../Common/Toast';
import './AddEntryForm.css';

const AddEntryForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    slNumber: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    vehicleNumber: '',
    strNumber: '',
    villages: [],
    quantity: '',
    driverName: '',
    mobileNumber: '',
    advanceAmount: ''
  });
  
  const [vehicles, setVehicles] = useState([]);
  const [allVillages, setAllVillages] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [filteredVillages, setFilteredVillages] = useState([]);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showVillageDropdown, setShowVillageDropdown] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [villageSearchQuery, setVillageSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    initializeForm();
    loadVehicles();
    loadVillages();
  }, []);

  const initializeForm = async () => {
    try {
      const nextSlNumber = await tripService.getNextSlNumber();
      setFormData(prev => ({
        ...prev,
        slNumber: nextSlNumber.toString().padStart(4, '0')
      }));
    } catch (error) {
      console.error('Error getting next SL number:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const vehicleList = await vehicleService.getAllVehicles();
      setVehicles(vehicleList);
      setFilteredVehicles(vehicleList);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadVillages = async () => {
    try {
      const villageList = await villageService.getAllVillages();
      setAllVillages(villageList);
      setFilteredVillages(villageList);
    } catch (error) {
      console.error('Error loading villages:', error);
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
    setFormData(prev => ({ ...prev, vehicleNumber: query }));
    
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
    }
  };

  const handleVehicleSelect = (vehicle) => {
    setFormData(prev => ({
      ...prev,
      vehicleNumber: vehicle.vehicleNumber,
      driverName: vehicle.driverName || '',
      mobileNumber: vehicle.mobileNumber || ''
    }));
    setVehicleSearchQuery(vehicle.vehicleNumber);
    setShowVehicleDropdown(false);
  };

  const handleVillageSearch = (query) => {
    setVillageSearchQuery(query);
    
    if (query.trim()) {
      const filtered = allVillages.filter(village =>
        village.villageName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredVillages(filtered);
      setShowVillageDropdown(true);
    } else {
      setFilteredVillages(allVillages);
      setShowVillageDropdown(false);
    }
  };

  const handleVillageSelect = (village) => {
    if (!formData.villages.includes(village.villageName)) {
      setFormData(prev => ({
        ...prev,
        villages: [...prev.villages, village.villageName]
      }));
      
      // Update village usage
      villageService.updateVillageUsage(village.id);
    }
    setVillageSearchQuery('');
    setShowVillageDropdown(false);
  };

  const addNewVillage = async () => {
    if (villageSearchQuery.trim() && !formData.villages.includes(villageSearchQuery.trim())) {
      try {
        const newVillage = await villageService.addVillage({
          villageName: villageSearchQuery.trim(),
          isActive: true,
          usageCount: 1
        });
        
        setFormData(prev => ({
          ...prev,
          villages: [...prev.villages, villageSearchQuery.trim()]
        }));
        
        setAllVillages(prev => [...prev, newVillage]);
        setVillageSearchQuery('');
        setShowVillageDropdown(false);
        showToastMessage('New village added successfully!');
      } catch (error) {
        console.error('Error adding new village:', error);
        showToastMessage('Error adding new village');
      }
    }
  };

  const removeVillage = (villageToRemove) => {
    setFormData(prev => ({
      ...prev,
      villages: prev.villages.filter(village => village !== villageToRemove)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle number is required';
    }
    
    if (!formData.strNumber.trim()) {
      newErrors.strNumber = 'STR number is required';
    }
    
    if (formData.villages.length === 0) {
      newErrors.villages = 'At least one village is required';
    }
    
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }
    
    if (!formData.driverName.trim()) {
      newErrors.driverName = 'Driver name is required';
    }
    
    if (!formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Valid 10-digit mobile number is required';
    }
    
    if (formData.advanceAmount && parseFloat(formData.advanceAmount) < 0) {
      newErrors.advanceAmount = 'Advance amount cannot be negative';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    setLoading(true);
    
    try {
      const tripData = createTripEntry({
        slNumber: parseInt(formData.slNumber),
        date: new Date(formData.date),
        vehicleNumber: formData.vehicleNumber.trim(),
        strNumber: formData.strNumber.trim(),
        villages: formData.villages,
        quantity: parseFloat(formData.quantity),
        driverName: formData.driverName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        advanceAmount: parseFloat(formData.advanceAmount) || 0
      });
      
      await tripService.addTrip(tripData);
      
      // Update vehicle information if changed
      const existingVehicle = vehicles.find(v => v.vehicleNumber === formData.vehicleNumber);
      if (!existingVehicle || 
          existingVehicle.driverName !== formData.driverName ||
          existingVehicle.mobileNumber !== formData.mobileNumber) {
        await vehicleService.addVehicle({
          vehicleNumber: formData.vehicleNumber,
          driverName: formData.driverName,
          mobileNumber: formData.mobileNumber,
          isActive: true
        });
      }
      
      showToastMessage('Trip entry added successfully!');
      
      // Navigate back after success
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error('Error adding trip entry:', error);
      showToastMessage('Error adding trip entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="add-entry-form">
      <div className="form-header">
        <h1 className="form-title">Add New Entry</h1>
        <p className="form-subtitle">Create a new trip entry with vehicle and driver details</p>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        {/* SL Number */}
        <div className="form-group">
          <label className="form-label">SL Number</label>
          <div className="sl-number-container">
            <input
              type="number"
              value={formData.slNumber}
              onChange={(e) => handleInputChange('slNumber', e.target.value)}
              placeholder="Enter SL number or leave empty for auto"
              className="form-input sl-number-input"
              min="1"
            />
            <button
              type="button"
              onClick={() => handleInputChange('slNumber', '')}
              className="auto-btn"
              title="Auto-generate SL number"
            >
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Auto
            </button>
          </div>
          <div className="sl-number-help">
            Leave empty to auto-generate next available number
          </div>
        </div>

        {/* Date */}
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className={`form-input ${errors.date ? 'error' : ''}`}
          />
          {errors.date && <span className="error-text">{errors.date}</span>}
        </div>

        {/* Vehicle Number with Search */}
        <div className="form-group">
          <label className="form-label">Vehicle Number</label>
          <div className="search-container">
            <input
              type="text"
              value={vehicleSearchQuery || formData.vehicleNumber}
              onChange={(e) => handleVehicleSearch(e.target.value)}
              onFocus={() => setShowVehicleDropdown(true)}
              placeholder="Search or enter vehicle number"
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

        {/* STR Number */}
        <div className="form-group">
          <label className="form-label">STR Number</label>
          <input
            type="text"
            value={formData.strNumber}
            onChange={(e) => handleInputChange('strNumber', e.target.value)}
            placeholder="Enter STR number"
            className={`form-input ${errors.strNumber ? 'error' : ''}`}
          />
          {errors.strNumber && <span className="error-text">{errors.strNumber}</span>}
        </div>

        {/* Villages */}
        <div className="form-group">
          <label className="form-label">Villages</label>
          <div className="villages-container">
            {formData.villages.length > 0 && (
              <div className="selected-villages">
                {formData.villages.map((village, index) => (
                  <span key={index} className="village-chip">
                    {village}
                    <button
                      type="button"
                      onClick={() => removeVillage(village)}
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
            
            <div className="search-container">
              <input
                type="text"
                value={villageSearchQuery}
                onChange={(e) => handleVillageSearch(e.target.value)}
                onFocus={() => setShowVillageDropdown(true)}
                placeholder="Search and add villages"
                className="form-input search-input"
              />
              <button
                type="button"
                onClick={addNewVillage}
                className="add-button"
                disabled={!villageSearchQuery.trim()}
              >
                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              
              {showVillageDropdown && filteredVillages.length > 0 && (
                <div className="dropdown">
                  {filteredVillages.map((village) => (
                    <div
                      key={village.id}
                      className={`dropdown-item ${formData.villages.includes(village.villageName) ? 'disabled' : ''}`}
                      onClick={() => !formData.villages.includes(village.villageName) && handleVillageSelect(village)}
                    >
                      <div className="dropdown-primary">{village.villageName}</div>
                      <div className="dropdown-secondary">Used {village.usageCount} times</div>
                    </div>
                  ))}
                  
                  {villageSearchQuery && !filteredVillages.some(v => v.villageName.toLowerCase() === villageSearchQuery.toLowerCase()) && (
                    <div className="dropdown-item new-item" onClick={addNewVillage}>
                      <div className="dropdown-primary">Add "{villageSearchQuery}"</div>
                      <div className="dropdown-secondary">New village</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {errors.villages && <span className="error-text">{errors.villages}</span>}
        </div>

        {/* Quantity */}
        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => handleInputChange('quantity', e.target.value)}
            placeholder="Enter quantity"
            className={`form-input ${errors.quantity ? 'error' : ''}`}
          />
          {errors.quantity && <span className="error-text">{errors.quantity}</span>}
        </div>

        {/* Driver Name */}
        <div className="form-group">
          <label className="form-label">Driver Name</label>
          <input
            type="text"
            value={formData.driverName}
            onChange={(e) => handleInputChange('driverName', e.target.value)}
            placeholder="Enter driver name"
            className={`form-input ${errors.driverName ? 'error' : ''}`}
          />
          {errors.driverName && <span className="error-text">{errors.driverName}</span>}
        </div>

        {/* Mobile Number */}
        <div className="form-group">
          <label className="form-label">Mobile Number</label>
          <input
            type="tel"
            value={formData.mobileNumber}
            onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
            placeholder="Enter 10-digit mobile number"
            className={`form-input ${errors.mobileNumber ? 'error' : ''}`}
          />
          {errors.mobileNumber && <span className="error-text">{errors.mobileNumber}</span>}
        </div>

        {/* Advance Amount */}
        <div className="form-group">
          <label className="form-label">Advance Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            value={formData.advanceAmount}
            onChange={(e) => handleInputChange('advanceAmount', e.target.value)}
            placeholder="Enter advance amount (optional)"
            className={`form-input ${errors.advanceAmount ? 'error' : ''}`}
          />
          {errors.advanceAmount && <span className="error-text">{errors.advanceAmount}</span>}
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
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17,21 17,13 7,13 7,21"></polyline>
                  <polyline points="7,3 7,8 15,8"></polyline>
                </svg>
                Save Entry
              </>
            )}
          </button>
        </div>
      </form>

      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default AddEntryForm;
