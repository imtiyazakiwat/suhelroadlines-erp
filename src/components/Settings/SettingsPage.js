import React, { useState, useEffect, useCallback } from 'react';
import { vehicleService, villageService } from '../../services/firebaseService';
import Toast from '../Common/Toast';
import VillageList from './VillageList';
import './SettingsPage.css';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    driverName: '',
    mobileNumber: '',
    vehicleType: 'lorry',
    isActive: true
  });
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleErrors, setVehicleErrors] = useState({});
  
  // Village form state
  const [villageForm, setVillageForm] = useState({
    villageName: '',
    isActive: true
  });
  const [editingVillage, setEditingVillage] = useState(null);
  const [villageErrors, setVillageErrors] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehicleList, villageList] = await Promise.all([
        vehicleService.getAllVehicles(),
        villageService.getAllVillages()
      ]);
      setVehicles(vehicleList);
      setVillages(villageList);
    } catch (error) {
      console.error('Error loading data:', error);
      showToastMessage('Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Vehicle functions
  const validateVehicleForm = () => {
    const errors = {};
    
    if (!vehicleForm.vehicleNumber.trim()) {
      errors.vehicleNumber = 'Vehicle number is required';
    }
    
    if (!vehicleForm.driverName.trim()) {
      errors.driverName = 'Driver name is required';
    }
    
    if (!vehicleForm.mobileNumber.trim()) {
      errors.mobileNumber = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(vehicleForm.mobileNumber)) {
      errors.mobileNumber = 'Valid 10-digit mobile number is required';
    }
    
    if (!vehicleForm.vehicleType) {
      errors.vehicleType = 'Vehicle type is required';
    } else if (!['lorry', 'tempo', 'pickup'].includes(vehicleForm.vehicleType)) {
      errors.vehicleType = 'Invalid vehicle type';
    }
    
    setVehicleErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateVehicleForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    try {
      if (editingVehicle) {
        await vehicleService.updateVehicle(editingVehicle.id, vehicleForm);
        showToastMessage('Vehicle updated successfully!');
      } else {
        await vehicleService.addVehicle(vehicleForm);
        showToastMessage('Vehicle added successfully!');
      }
      
      resetVehicleForm();
      loadData();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      showToastMessage('Error saving vehicle');
    }
  };

  const editVehicle = (vehicle) => {
    setVehicleForm({
      vehicleNumber: vehicle.vehicleNumber,
      driverName: vehicle.driverName || '',
      mobileNumber: vehicle.mobileNumber || '',
      vehicleType: vehicle.vehicleType || 'lorry',
      isActive: vehicle.isActive !== false
    });
    setEditingVehicle(vehicle);
    setVehicleErrors({});
  };

  const deleteVehicle = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) {
      return;
    }
    
    try {
      await vehicleService.deleteVehicle(vehicleId);
      showToastMessage('Vehicle deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      showToastMessage('Error deleting vehicle');
    }
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      vehicleNumber: '',
      driverName: '',
      mobileNumber: '',
      vehicleType: 'lorry',
      isActive: true
    });
    setEditingVehicle(null);
    setVehicleErrors({});
  };

  // Village functions
  const validateVillageForm = () => {
    const errors = {};
    
    if (!villageForm.villageName.trim()) {
      errors.villageName = 'Village name is required';
    }
    
    setVillageErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleVillageSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateVillageForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    try {
      if (editingVillage) {
        await villageService.updateVillage(editingVillage.id, villageForm);
        showToastMessage('Village updated successfully!');
      } else {
        await villageService.addVillage(villageForm);
        showToastMessage('Village added successfully!');
      }
      
      resetVillageForm();
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error saving village:', error);
      showToastMessage('Error saving village');
    }
  };

  const editVillage = (village) => {
    setVillageForm({
      villageName: village.villageName,
      isActive: village.isActive !== false
    });
    setEditingVillage(village);
    setVillageErrors({});
  };

  const deleteVillage = async (villageId) => {
    try {
      await villageService.deleteVillage(villageId);
      setRefreshTrigger(prev => prev + 1);
      return Promise.resolve();
    } catch (error) {
      console.error('Error deleting village:', error);
      throw error;
    }
  };

  const resetVillageForm = () => {
    setVillageForm({
      villageName: '',
      isActive: true
    });
    setEditingVillage(null);
    setVillageErrors({});
  };

  const exportVCF = () => {
    if (vehicles.length === 0) {
      showToastMessage('No vehicles to export');
      return;
    }
    
    let vcfContent = '';
    vehicles.forEach((vehicle, index) => {
      if (vehicle.driverName && vehicle.mobileNumber) {
        vcfContent += `BEGIN:VCARD\n`;
        vcfContent += `VERSION:3.0\n`;
        vcfContent += `FN:${vehicle.driverName} (${vehicle.vehicleNumber})\n`;
        vcfContent += `N:${vehicle.driverName};;;;\n`;
        vcfContent += `TEL:${vehicle.mobileNumber}\n`;
        vcfContent += `NOTE:Vehicle: ${vehicle.vehicleNumber}\n`;
        vcfContent += `END:VCARD\n`;
        if (index < vehicles.length - 1) vcfContent += '\n';
      }
    });
    
    if (vcfContent) {
      const blob = new Blob([vcfContent], { type: 'text/vcard' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SuhelRoadline_Contacts.vcf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToastMessage('Contacts exported successfully!');
    } else {
      showToastMessage('No valid contacts to export');
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage vehicles, drivers, and villages</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicles')}
        >
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
          </svg>
          Vehicles ({vehicles.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'villages' ? 'active' : ''}`}
          onClick={() => setActiveTab('villages')}
        >
          <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9,22 9,12 15,12 15,22"></polyline>
          </svg>
          Villages ({villages.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'vehicles' ? (
          <div className="vehicles-section">
            {/* Vehicle Form */}
            <div className="form-section">
              <div className="form-header">
                <h2>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
                <div className="form-actions">
                  {editingVehicle && (
                    <button onClick={resetVehicleForm} className="btn btn-ghost btn-sm">
                      Cancel Edit
                    </button>
                  )}
                  <button onClick={exportVCF} className="btn btn-secondary btn-sm">
                    <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7,10 12,15 17,10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export VCF
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleVehicleSubmit} className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Vehicle Number</label>
                    <input
                      type="text"
                      value={vehicleForm.vehicleNumber}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                      placeholder="Enter vehicle number"
                      className={`form-input ${vehicleErrors.vehicleNumber ? 'error' : ''}`}
                    />
                    {vehicleErrors.vehicleNumber && <span className="error-text">{vehicleErrors.vehicleNumber}</span>}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Driver Name</label>
                    <input
                      type="text"
                      value={vehicleForm.driverName}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, driverName: e.target.value }))}
                      placeholder="Enter driver name"
                      className={`form-input ${vehicleErrors.driverName ? 'error' : ''}`}
                    />
                    {vehicleErrors.driverName && <span className="error-text">{vehicleErrors.driverName}</span>}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Mobile Number</label>
                    <input
                      type="tel"
                      value={vehicleForm.mobileNumber}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                      placeholder="Enter 10-digit mobile number"
                      className={`form-input ${vehicleErrors.mobileNumber ? 'error' : ''}`}
                    />
                    {vehicleErrors.mobileNumber && <span className="error-text">{vehicleErrors.mobileNumber}</span>}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <select
                      value={vehicleForm.vehicleType}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                      className={`form-input ${vehicleErrors.vehicleType ? 'error' : ''}`}
                    >
                      <option value="lorry">Lorry</option>
                      <option value="tempo">Tempo</option>
                      <option value="pickup">Pickup</option>
                    </select>
                    {vehicleErrors.vehicleType && <span className="error-text">{vehicleErrors.vehicleType}</span>}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <div className="toggle-group">
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={vehicleForm.isActive}
                          onChange={(e) => setVehicleForm(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="toggle-input"
                        />
                        <span className="toggle-slider"></span>
                        <span className="toggle-text">{vehicleForm.isActive ? 'Active' : 'Inactive'}</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="form-submit">
                  <button type="submit" className="btn btn-primary">
                    <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17,21 17,13 7,13 7,21"></polyline>
                      <polyline points="7,3 7,8 15,8"></polyline>
                    </svg>
                    {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                  </button>
                </div>
              </form>
            </div>

            {/* Vehicles Table */}
            <div className="list-section">
              <h3>Vehicles</h3>
              {loading ? (
                <div className="loading-state">
                  <div className="loading"></div>
                  <p>Loading vehicles...</p>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="empty-state">
                  <svg className="icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                    <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                    <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
                  </svg>
                  <h4>No vehicles found</h4>
                  <p>Add your first vehicle using the form above</p>
                </div>
              ) : (
                <div className="responsive-table">
                  <div className="table">
                    <div className="table-header">
                      <div>Vehicle</div>
                      <div>Type</div>
                      <div>Driver</div>
                      <div>Mobile</div>
                      <div>Status</div>
                      <div>Actions</div>
                    </div>
                    {vehicles.map((vehicle) => (
                      <div key={vehicle.id} className={`table-row ${!vehicle.isActive ? 'inactive' : ''}`}>
                        <div className="cell-vehicle">{vehicle.vehicleNumber}</div>
                        <div>
                          <span className={`vehicle-type-badge ${vehicle.vehicleType || 'lorry'}`}>
                            {vehicle.vehicleType || 'lorry'}
                          </span>
                        </div>
                        <div>{vehicle.driverName || 'N/A'}</div>
                        <div>{vehicle.mobileNumber || 'N/A'}</div>
                        <div>
                          <span className={`status-badge ${vehicle.isActive ? 'active' : 'inactive'}`}>
                            {vehicle.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="row-actions">
                          <button onClick={() => editVehicle(vehicle)} className="btn btn-ghost btn-sm">Edit</button>
                          <button onClick={() => deleteVehicle(vehicle.id)} className="btn btn-ghost btn-sm delete-btn">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="villages-section">
            {/* Village Form */}
            <div className="form-section">
              <div className="form-header">
                <h2>{editingVillage ? 'Edit Village' : 'Add New Village'}</h2>
                {editingVillage && (
                  <button onClick={resetVillageForm} className="btn btn-ghost btn-sm">
                    Cancel Edit
                  </button>
                )}
              </div>
              
              <form onSubmit={handleVillageSubmit} className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Village Name</label>
                    <input
                      type="text"
                      value={villageForm.villageName}
                      onChange={(e) => setVillageForm(prev => ({ ...prev, villageName: e.target.value }))}
                      placeholder="Enter village name"
                      className={`form-input ${villageErrors.villageName ? 'error' : ''}`}
                    />
                    {villageErrors.villageName && <span className="error-text">{villageErrors.villageName}</span>}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <div className="toggle-group">
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={villageForm.isActive}
                          onChange={(e) => setVillageForm(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="toggle-input"
                        />
                        <span className="toggle-slider"></span>
                        <span className="toggle-text">{villageForm.isActive ? 'Active' : 'Inactive'}</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="form-submit">
                  <button type="submit" className="btn btn-primary">
                    <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17,21 17,13 7,13 7,21"></polyline>
                      <polyline points="7,3 7,8 15,8"></polyline>
                    </svg>
                    {editingVillage ? 'Update Village' : 'Add Village'}
                  </button>
                </div>
              </form>
            </div>

            {/* Villages List */}
            <div className="list-section">
              <h3>Villages List</h3>
              <VillageList
                onEdit={editVillage}
                onDelete={deleteVillage}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        )}
      </div>

      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default SettingsPage;
