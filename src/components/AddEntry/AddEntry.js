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
  Chip,
  Searchbar,
  Popup,
  Page,
  Navbar,
  NavRight,
  Link,


} from 'framework7-react';
import Toast from '../Common/Toast';
import { useNavigate } from 'react-router-dom';
import { tripService, vehicleService, villageService } from '../../services/firebaseService';
import { createTripEntry } from '../../types';
import { format } from 'date-fns';
import './AddEntry.css';

const AddEntry = () => {
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
  const [showVehicleSearch, setShowVehicleSearch] = useState(false);
  const [showVillageSearch, setShowVillageSearch] = useState(false);
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

  const handleVehicleSelect = async (vehicle) => {
    setFormData(prev => ({
      ...prev,
      vehicleNumber: vehicle.vehicleNumber,
      driverName: vehicle.driverName || '',
      mobileNumber: vehicle.mobileNumber || ''
    }));
    setShowVehicleSearch(false);
    setVehicleSearchQuery('');
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
    setShowVillageSearch(false);
    setVillageSearchQuery('');
  };

  const removeVillage = (villageToRemove) => {
    setFormData(prev => ({
      ...prev,
      villages: prev.villages.filter(village => village !== villageToRemove)
    }));
  };

  const addNewVillage = async (villageName) => {
    if (villageName.trim() && !formData.villages.includes(villageName.trim())) {
      try {
        const newVillage = await villageService.addVillage({
          villageName: villageName.trim(),
          isActive: true,
          usageCount: 1
        });
        
        setFormData(prev => ({
          ...prev,
          villages: [...prev.villages, villageName.trim()]
        }));
        
        setAllVillages(prev => [...prev, newVillage]);
        setShowVillageSearch(false);
        setVillageSearchQuery('');
      } catch (error) {
        console.error('Error adding new village:', error);
        showToastMessage('Error adding new village');
      }
    }
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

  const handleSubmit = async () => {
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
      
      // Reset form and navigate back
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

  const handleVillageSearch = (query) => {
    setVillageSearchQuery(query);
    if (query.trim()) {
      const filtered = allVillages.filter(village =>
        village.villageName.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredVillages(filtered);
    } else {
      setFilteredVillages(allVillages);
    }
  };

  return (
    <Block className="add-entry-container">
      <Card className="form-card">
        <CardContent>
          <h2>Add New Entry</h2>
          
          <List className="form-list">
            {/* SL Number */}
            <ListInput
              label="SL Number"
              type="text"
              placeholder="Auto-generated"
              value={`#${formData.slNumber}`}
              readonly
              className="sl-number-input"
            />
            
            {/* Date */}
            <ListInput
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              errorMessage={errors.date}
              errorMessageForce={!!errors.date}
            />
            
            {/* Vehicle Number */}
            <ListItem 
              title="Vehicle Number"
              after={formData.vehicleNumber || "Select Vehicle"}
              onClick={() => setShowVehicleSearch(true)}
              className={errors.vehicleNumber ? 'error-field' : ''}
            >
              <Icon slot="media" ios="f7:car" />
            </ListItem>
            {errors.vehicleNumber && (
              <div className="error-message">{errors.vehicleNumber}</div>
            )}
            
            {/* STR Number */}
            <ListInput
              label="STR Number"
              type="text"
              placeholder="Enter STR number"
              value={formData.strNumber}
              onChange={(e) => handleInputChange('strNumber', e.target.value)}
              errorMessage={errors.strNumber}
              errorMessageForce={!!errors.strNumber}
            />
            
            {/* Villages */}
            <ListItem className="villages-section">
              <div className="villages-header">
                <span className="villages-label">Villages</span>
                <Button
                  className="add-village-btn"
                  onClick={() => setShowVillageSearch(true)}
                >
                  <Icon ios="f7:plus" size="16" />
                  Add Village
                </Button>
              </div>
              <div className="villages-chips">
                {formData.villages.map((village, index) => (
                  <Chip
                    key={index}
                    text={village}
                    deleteable
                    onDelete={() => removeVillage(village)}
                    className="village-chip"
                  />
                ))}
                {formData.villages.length === 0 && (
                  <span className="no-villages">No villages selected</span>
                )}
              </div>
              {errors.villages && (
                <div className="error-message">{errors.villages}</div>
              )}
            </ListItem>
            
            {/* Quantity */}
            <ListInput
              label="Quantity"
              type="number"
              placeholder="Enter quantity"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              errorMessage={errors.quantity}
              errorMessageForce={!!errors.quantity}
            />
            
            {/* Driver Name */}
            <ListInput
              label="Driver Name"
              type="text"
              placeholder="Enter driver name"
              value={formData.driverName}
              onChange={(e) => handleInputChange('driverName', e.target.value)}
              errorMessage={errors.driverName}
              errorMessageForce={!!errors.driverName}
            />
            
            {/* Mobile Number */}
            <ListInput
              label="Mobile Number"
              type="tel"
              placeholder="Enter 10-digit mobile number"
              value={formData.mobileNumber}
              onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
              errorMessage={errors.mobileNumber}
              errorMessageForce={!!errors.mobileNumber}
            />
            
            {/* Advance Amount */}
            <ListInput
              label="Advance Amount (₹)"
              type="number"
              placeholder="Enter advance amount (optional)"
              value={formData.advanceAmount}
              onChange={(e) => handleInputChange('advanceAmount', e.target.value)}
              errorMessage={errors.advanceAmount}
              errorMessageForce={!!errors.advanceAmount}
            />
          </List>
          
          <div className="form-actions">
            <Button
              className="btn-secondary"
              onClick={() => navigate('/')}
            >
              Cancel
            </Button>
            <Button
              className="btn-primary"
              onClick={handleSubmit}
              preloader
              loading={loading}
            >
              Save Entry
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Search Popup */}
      <Popup opened={showVehicleSearch} onPopupClosed={() => setShowVehicleSearch(false)}>
        <Page>
          <Navbar title="Select Vehicle">
            <NavRight>
              <Link onClick={() => setShowVehicleSearch(false)}>Close</Link>
            </NavRight>
          </Navbar>
          
          <Searchbar
            placeholder="Search vehicles..."
            value={vehicleSearchQuery}
            onSearchbarInput={(e) => handleVehicleSearch(e.target.value)}
            onSearchbarClear={() => handleVehicleSearch('')}
          />
          
          <List>
            {filteredVehicles.map((vehicle) => (
              <ListItem
                key={vehicle.vehicleNumber}
                title={vehicle.vehicleNumber}
                subtitle={`${vehicle.driverName} • ${vehicle.mobileNumber}`}
                onClick={() => handleVehicleSelect(vehicle)}
              >
                <Icon slot="media" ios="f7:car" />
              </ListItem>
            ))}
            
            {vehicleSearchQuery && filteredVehicles.length === 0 && (
              <ListItem
                title={`Add "${vehicleSearchQuery}" as new vehicle`}
                onClick={() => {
                  handleInputChange('vehicleNumber', vehicleSearchQuery);
                  setShowVehicleSearch(false);
                  setVehicleSearchQuery('');
                }}
              >
                <Icon slot="media" ios="f7:plus_circle" />
              </ListItem>
            )}
          </List>
        </Page>
      </Popup>

      {/* Village Search Popup */}
      <Popup opened={showVillageSearch} onPopupClosed={() => setShowVillageSearch(false)}>
        <Page>
          <Navbar title="Select Village">
            <NavRight>
              <Link onClick={() => setShowVillageSearch(false)}>Close</Link>
            </NavRight>
          </Navbar>
          
          <Searchbar
            placeholder="Search villages..."
            value={villageSearchQuery}
            onSearchbarInput={(e) => handleVillageSearch(e.target.value)}
            onSearchbarClear={() => handleVillageSearch('')}
          />
          
          <List>
            {filteredVillages.map((village) => (
              <ListItem
                key={village.id}
                title={village.villageName}
                subtitle={`Used ${village.usageCount} times`}
                onClick={() => handleVillageSelect(village)}
                disabled={formData.villages.includes(village.villageName)}
              >
                <Icon slot="media" ios="f7:location" />
              </ListItem>
            ))}
            
            {villageSearchQuery && filteredVillages.length === 0 && (
              <ListItem
                title={`Add "${villageSearchQuery}" as new village`}
                onClick={() => addNewVillage(villageSearchQuery)}
              >
                <Icon slot="media" ios="f7:plus_circle" />
              </ListItem>
            )}
          </List>
        </Page>
      </Popup>

      {/* Toast */}
      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </Block>
  );
};

export default AddEntry;
