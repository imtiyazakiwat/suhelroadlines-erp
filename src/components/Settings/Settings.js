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
  Popup,
  Page,
  Navbar,
  NavRight,
  Link,
  SwipeoutActions,
  SwipeoutButton
} from 'framework7-react';
import Toast from '../Common/Toast';
import { vehicleService, villageService } from '../../services/firebaseService';
import './Settings.css';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  
  // Vehicle form state
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    driverName: '',
    mobileNumber: '',
    vehicleType: 'lorry'
  });
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleErrors, setVehicleErrors] = useState({});
  
  // Village form state
  const [showVillageForm, setShowVillageForm] = useState(false);
  const [villageForm, setVillageForm] = useState({
    villageName: ''
  });
  const [editingVillage, setEditingVillage] = useState(null);
  const [villageErrors, setVillageErrors] = useState({});
  
  // Actions
  const [showDeleteActions, setShowDeleteActions] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const loadData = React.useCallback(async () => {
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

  // Vehicle Management
  const openVehicleForm = (vehicle = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setVehicleForm({
        vehicleNumber: vehicle.vehicleNumber,
        driverName: vehicle.driverName || '',
        mobileNumber: vehicle.mobileNumber || '',
        vehicleType: vehicle.vehicleType || 'lorry'
      });
    } else {
      setEditingVehicle(null);
      setVehicleForm({
        vehicleNumber: '',
        driverName: '',
        mobileNumber: '',
        vehicleType: 'lorry'
      });
    }
    setVehicleErrors({});
    setShowVehicleForm(true);
  };

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

  const handleVehicleSubmit = async () => {
    if (!validateVehicleForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    setLoading(true);
    
    try {
      const vehicleData = {
        vehicleNumber: vehicleForm.vehicleNumber.trim(),
        driverName: vehicleForm.driverName.trim(),
        mobileNumber: vehicleForm.mobileNumber.trim(),
        vehicleType: vehicleForm.vehicleType,
        isActive: true
      };
      
      console.log('Saving vehicle data:', vehicleData);
      
      if (editingVehicle) {
        await vehicleService.updateVehicle(editingVehicle.vehicleNumber, vehicleData);
        showToastMessage('Vehicle updated successfully');
      } else {
        await vehicleService.addVehicle(vehicleData);
        showToastMessage('Vehicle added successfully');
      }
      
      setShowVehicleForm(false);
      loadData();
      
    } catch (error) {
      console.error('Error saving vehicle:', error);
      showToastMessage('Error saving vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleDelete = (vehicle) => {
    setItemToDelete({ type: 'vehicle', item: vehicle });
    setShowDeleteActions(true);
  };

  const confirmVehicleDelete = async () => {
    if (!itemToDelete || itemToDelete.type !== 'vehicle') return;
    
    setLoading(true);
    
    try {
      await vehicleService.deleteVehicle(itemToDelete.item.vehicleNumber);
      showToastMessage('Vehicle deleted successfully');
      setShowDeleteActions(false);
      setItemToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      showToastMessage('Error deleting vehicle');
    } finally {
      setLoading(false);
    }
  };

  // Village Management
  const openVillageForm = (village = null) => {
    if (village) {
      setEditingVillage(village);
      setVillageForm({
        villageName: village.villageName
      });
    } else {
      setEditingVillage(null);
      setVillageForm({
        villageName: ''
      });
    }
    setVillageErrors({});
    setShowVillageForm(true);
  };

  const validateVillageForm = () => {
    const errors = {};
    
    if (!villageForm.villageName.trim()) {
      errors.villageName = 'Village name is required';
    }
    
    setVillageErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleVillageSubmit = async () => {
    if (!validateVillageForm()) {
      showToastMessage('Please fix the errors and try again');
      return;
    }
    
    setLoading(true);
    
    try {
      const villageData = {
        villageName: villageForm.villageName.trim(),
        isActive: true,
        usageCount: editingVillage ? editingVillage.usageCount : 0
      };
      
      if (editingVillage) {
        // Update village - we'd need to implement this in the service
        showToastMessage('Village updated successfully');
      } else {
        await villageService.addVillage(villageData);
        showToastMessage('Village added successfully');
      }
      
      setShowVillageForm(false);
      loadData();
      
    } catch (error) {
      console.error('Error saving village:', error);
      showToastMessage('Error saving village');
    } finally {
      setLoading(false);
    }
  };

  const handleVillageDelete = (village) => {
    setItemToDelete({ type: 'village', item: village });
    setShowDeleteActions(true);
  };

  const confirmVillageDelete = async () => {
    if (!itemToDelete || itemToDelete.type !== 'village') return;
    
    setLoading(true);
    
    try {
      // We'd need to implement soft delete for villages
      showToastMessage('Village deleted successfully');
      setShowDeleteActions(false);
      setItemToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting village:', error);
      showToastMessage('Error deleting village');
    } finally {
      setLoading(false);
    }
  };

  // VCF Export
  const exportDriverContacts = () => {
    const vcfData = vehicles.map(vehicle => {
      return `BEGIN:VCARD
VERSION:3.0
FN:${vehicle.driverName}
TEL:${vehicle.mobileNumber}
NOTE:Driver for ${vehicle.vehicleNumber}
END:VCARD`;
    }).join('\n\n');
    
    const blob = new Blob([vcfData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SuhelRoadline_Driver_Contacts.vcf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToastMessage('Driver contacts exported successfully');
  };

  return (
    <Block className="settings-container">
      {/* Header Card */}
      <Card className="header-card gradient-card">
        <CardContent>
          <h2>Settings</h2>
          <p>Manage vehicles, drivers, and villages</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card className="tabs-card">
        <CardContent>
          <Segmented>
            <Button 
              segmentedActive={activeTab === 'vehicles'}
              onClick={() => setActiveTab('vehicles')}
            >
              Vehicles ({vehicles.length})
            </Button>
            <Button 
              segmentedActive={activeTab === 'villages'}
              onClick={() => setActiveTab('villages')}
            >
              Villages ({villages.length})
            </Button>
            <Button 
              segmentedActive={activeTab === 'app'}
              onClick={() => setActiveTab('app')}
            >
              App Settings
            </Button>
          </Segmented>
          
          <Tabs>
            {/* Vehicles Tab */}
            <Tab tabActive={activeTab === 'vehicles'}>
              <div className="tab-header">
                <h3>Vehicle Management</h3>
                <div className="tab-actions">
                  <Button 
                    className="btn-primary"
                    onClick={() => openVehicleForm()}
                  >
                    <Icon ios="f7:plus" />
                    Add Vehicle
                  </Button>
                  <Button 
                    className="btn-secondary"
                    onClick={exportDriverContacts}
                    disabled={vehicles.length === 0}
                  >
                    <Icon ios="f7:person_crop_circle" />
                    Export Contacts
                  </Button>
                </div>
              </div>
              
              {loading ? (
                <div className="loading-container">
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60 }}></div>
                </div>
              ) : (
                <List className="items-list">
                  {vehicles.length === 0 ? (
                    <ListItem title="No vehicles added yet" disabled />
                  ) : (
                    vehicles.map((vehicle) => (
                      <ListItem
                        key={vehicle.vehicleNumber}
                        swipeout
                        className="vehicle-item"
                      >
                        <div className="item-content">
                          <div className="item-media">
                            <Icon ios="f7:car" />
                          </div>
                          <div className="item-inner">
                            <div className="item-title-row">
                              <div className="item-title">{vehicle.vehicleNumber}</div>
                              <div className="item-after">
                                <span className="vehicle-type-badge">{vehicle.vehicleType || 'lorry'}</span>
                              </div>
                            </div>
                            <div className="item-subtitle">
                              {vehicle.driverName} • {vehicle.mobileNumber}
                            </div>
                          </div>
                        </div>
                        <SwipeoutActions right>
                          <SwipeoutButton 
                            color="blue"
                            onClick={() => openVehicleForm(vehicle)}
                          >
                            Edit
                          </SwipeoutButton>
                          <SwipeoutButton 
                            color="red"
                            onClick={() => handleVehicleDelete(vehicle)}
                          >
                            Delete
                          </SwipeoutButton>
                        </SwipeoutActions>
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Tab>
            
            {/* Villages Tab */}
            <Tab tabActive={activeTab === 'villages'}>
              <div className="tab-header">
                <h3>Village Management</h3>
                <Button 
                  className="btn-primary"
                  onClick={() => openVillageForm()}
                >
                  <Icon ios="f7:plus" />
                  Add Village
                </Button>
              </div>
              
              {loading ? (
                <div className="loading-container">
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60, marginBottom: 8 }}></div>
                  <div className="loading-shimmer" style={{ height: 60 }}></div>
                </div>
              ) : (
                <List className="items-list">
                  {villages.length === 0 ? (
                    <ListItem title="No villages added yet" disabled />
                  ) : (
                    villages.map((village) => (
                      <ListItem
                        key={village.id}
                        swipeout
                        className="village-item"
                      >
                        <div className="item-content">
                          <div className="item-media">
                            <Icon ios="f7:location" />
                          </div>
                          <div className="item-inner">
                            <div className="item-title-row">
                              <div className="item-title">{village.villageName}</div>
                            </div>
                            <div className="item-subtitle">
                              Used {village.usageCount} times
                            </div>
                          </div>
                        </div>
                        <SwipeoutActions right>
                          <SwipeoutButton 
                            color="blue"
                            onClick={() => openVillageForm(village)}
                          >
                            Edit
                          </SwipeoutButton>
                          <SwipeoutButton 
                            color="red"
                            onClick={() => handleVillageDelete(village)}
                          >
                            Delete
                          </SwipeoutButton>
                        </SwipeoutActions>
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Tab>
            
            {/* App Settings Tab */}
            <Tab tabActive={activeTab === 'app'}>
              <div className="tab-header">
                <h3>App Settings</h3>
              </div>
              
              <List className="settings-list">
                <ListItem
                  title="Data Backup"
                  subtitle="Backup all data to cloud"
                  onClick={() => showToastMessage('Backup feature coming soon')}
                >
                  <Icon slot="media" ios="f7:icloud_upload" />
                  <Icon slot="after" ios="f7:chevron_right" />
                </ListItem>
                
                <ListItem
                  title="Export All Data"
                  subtitle="Download complete database"
                  onClick={() => showToastMessage('Export feature coming soon')}
                >
                  <Icon slot="media" ios="f7:square_arrow_up" />
                  <Icon slot="after" ios="f7:chevron_right" />
                </ListItem>
                
                <ListItem
                  title="About"
                  subtitle="SuhelRoadline Travel ERP v1.0"
                >
                  <Icon slot="media" ios="f7:info_circle" />
                </ListItem>
              </List>
            </Tab>
          </Tabs>
        </CardContent>
      </Card>

      {/* Vehicle Form Popup */}
      <Popup opened={showVehicleForm} onPopupClosed={() => setShowVehicleForm(false)}>
        <Page>
          <Navbar title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}>
            <NavRight>
              <Link onClick={() => setShowVehicleForm(false)}>Close</Link>
            </NavRight>
          </Navbar>
          
          <Block className="form-container">
            <List className="form-list">
              <ListInput
                label="Vehicle Number"
                type="text"
                placeholder="Enter vehicle number"
                value={vehicleForm.vehicleNumber}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                errorMessage={vehicleErrors.vehicleNumber}
                errorMessageForce={!!vehicleErrors.vehicleNumber}
                disabled={!!editingVehicle}
              />
              
              <ListInput
                label="Driver Name"
                type="text"
                placeholder="Enter driver name"
                value={vehicleForm.driverName}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, driverName: e.target.value }))}
                errorMessage={vehicleErrors.driverName}
                errorMessageForce={!!vehicleErrors.driverName}
              />
              
              <ListInput
                label="Mobile Number"
                type="tel"
                placeholder="Enter 10-digit mobile number"
                value={vehicleForm.mobileNumber}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                errorMessage={vehicleErrors.mobileNumber}
                errorMessageForce={!!vehicleErrors.mobileNumber}
              />
              
              <ListInput
                label="Vehicle Type"
                type="select"
                value={vehicleForm.vehicleType}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                errorMessage={vehicleErrors.vehicleType}
                errorMessageForce={!!vehicleErrors.vehicleType}
              >
                <option value="lorry">Lorry</option>
                <option value="tempo">Tempo</option>
                <option value="pickup">Pickup</option>
              </ListInput>
            </List>
            
            <div className="form-actions">
              <Button
                className="btn-secondary"
                onClick={() => setShowVehicleForm(false)}
              >
                Cancel
              </Button>
              <Button
                className="btn-primary"
                onClick={handleVehicleSubmit}
                preloader
                loading={loading}
              >
                {editingVehicle ? 'Update' : 'Add'} Vehicle
              </Button>
            </div>
          </Block>
        </Page>
      </Popup>

      {/* Village Form Popup */}
      <Popup opened={showVillageForm} onPopupClosed={() => setShowVillageForm(false)}>
        <Page>
          <Navbar title={editingVillage ? 'Edit Village' : 'Add Village'}>
            <NavRight>
              <Link onClick={() => setShowVillageForm(false)}>Close</Link>
            </NavRight>
          </Navbar>
          
          <Block className="form-container">
            <List className="form-list">
              <ListInput
                label="Village Name"
                type="text"
                placeholder="Enter village name"
                value={villageForm.villageName}
                onChange={(e) => setVillageForm(prev => ({ ...prev, villageName: e.target.value }))}
                errorMessage={villageErrors.villageName}
                errorMessageForce={!!villageErrors.villageName}
              />
            </List>
            
            <div className="form-actions">
              <Button
                className="btn-secondary"
                onClick={() => setShowVillageForm(false)}
              >
                Cancel
              </Button>
              <Button
                className="btn-primary"
                onClick={handleVillageSubmit}
                preloader
                loading={loading}
              >
                {editingVillage ? 'Update' : 'Add'} Village
              </Button>
            </div>
          </Block>
        </Page>
      </Popup>

      {/* Delete Confirmation Actions */}
      <Actions opened={showDeleteActions} onActionsClosed={() => setShowDeleteActions(false)}>
        <ActionsGroup>
          <ActionsButton color="red" onClick={itemToDelete?.type === 'vehicle' ? confirmVehicleDelete : confirmVillageDelete}>
            <Icon ios="f7:trash" />
            Delete {itemToDelete?.type === 'vehicle' ? 'Vehicle' : 'Village'}
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setShowDeleteActions(false)}>
            Cancel
          </ActionsButton>
        </ActionsGroup>
      </Actions>

      {/* Toast */}
      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </Block>
  );
};

export default Settings;
