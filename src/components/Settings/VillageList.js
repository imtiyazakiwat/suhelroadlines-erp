import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { villageService } from '../../services/firebaseService';
import Toast from '../Common/Toast';
import './VillageList.css';

const VillageList = ({ onEdit, onDelete, refreshTrigger }) => {
  const [villages, setVillages] = useState([]);
  const [filteredVillages, setFilteredVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('usageCount'); // 'usageCount', 'name', 'created'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [displayCount, setDisplayCount] = useState(20);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const loadVillages = useCallback(async () => {
    setLoading(true);
    try {
      const villageList = await villageService.getAllVillages();
      setVillages(villageList);
    } catch (error) {
      console.error('Error loading villages:', error);
      showToastMessage('Error loading villages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVillages();
  }, [loadVillages, refreshTrigger]);

  const filteredAndSortedVillages = useMemo(() => {
    let filtered = villages;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = villages.filter(village =>
        village.villageName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.villageName.toLowerCase();
          bValue = b.villageName.toLowerCase();
          break;
        case 'created':
          aValue = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
          bValue = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
          break;
        case 'usageCount':
        default:
          aValue = a.usageCount || 0;
          bValue = b.usageCount || 0;
          break;
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [villages, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    setFilteredVillages(filteredAndSortedVillages.slice(0, displayCount));
  }, [filteredAndSortedVillages, displayCount]);

  const loadMore = useCallback(() => {
    if (displayCount < filteredAndSortedVillages.length) {
      setDisplayCount(prev => Math.min(prev + 20, filteredAndSortedVillages.length));
    }
  }, [displayCount, filteredAndSortedVillages.length]);

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleEdit = (village) => {
    onEdit(village);
  };

  const handleDelete = async (village) => {
    if (!window.confirm(`Are you sure you want to delete "${village.villageName}"?`)) {
      return;
    }
    
    try {
      await onDelete(village.id);
      showToastMessage('Village deleted successfully!');
      loadVillages();
    } catch (error) {
      console.error('Error deleting village:', error);
      showToastMessage('Error deleting village');
    }
  };

  if (loading) {
    return (
      <div className="village-list-loading">
        <div className="loading"></div>
        <p>Loading villages...</p>
      </div>
    );
  }

  return (
    <div className="village-list-container">
      {/* Search and Sort Controls */}
      <div className="village-controls">
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search villages..."
            className="search-input"
          />
          <svg className="search-icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </div>

        <div className="sort-controls">
          <button
            className={`sort-btn ${sortBy === 'usageCount' ? 'active' : ''}`}
            onClick={() => handleSort('usageCount')}
          >
            Usage
            {sortBy === 'usageCount' && (
              <svg className="sort-icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {sortOrder === 'desc' ? (
                  <polyline points="6,9 12,15 18,9"></polyline>
                ) : (
                  <polyline points="6,15 12,9 18,15"></polyline>
                )}
              </svg>
            )}
          </button>
          
          <button
            className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => handleSort('name')}
          >
            Name
            {sortBy === 'name' && (
              <svg className="sort-icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {sortOrder === 'desc' ? (
                  <polyline points="6,9 12,15 18,9"></polyline>
                ) : (
                  <polyline points="6,15 12,9 18,15"></polyline>
                )}
              </svg>
            )}
          </button>
          
          <button
            className={`sort-btn ${sortBy === 'created' ? 'active' : ''}`}
            onClick={() => handleSort('created')}
          >
            Created
            {sortBy === 'created' && (
              <svg className="sort-icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {sortOrder === 'desc' ? (
                  <polyline points="6,9 12,15 18,9"></polyline>
                ) : (
                  <polyline points="6,15 12,9 18,15"></polyline>
                )}
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <span className="results-count">
          Showing {filteredVillages.length} of {filteredAndSortedVillages.length} villages
          {searchTerm && ` matching "${searchTerm}"`}
        </span>
      </div>

      {/* Village Table */}
      {filteredVillages.length === 0 ? (
        <div className="empty-state">
          <svg className="icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9,22 9,12 15,12 15,22"></polyline>
          </svg>
          <h4>{searchTerm ? 'No villages found' : 'No villages yet'}</h4>
          <p>
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Add your first village using the form above'
            }
          </p>
        </div>
      ) : (
        <div className="responsive-table">
          <div className="table">
            <div className="table-header">
              <div>Village</div>
              <div>Usage</div>
              <div>Last Used</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {filteredVillages.map((village) => (
              <div key={village.id} className={`table-row ${!village.isActive ? 'inactive' : ''}`}>
                <div className="cell-name">{village.villageName}</div>
                <div>{village.usageCount || 0}</div>
                <div>{village.lastUsed ? new Date(village.lastUsed.toDate?.() || village.lastUsed).toLocaleDateString() : '-'}</div>
                <div>
                  <span className={`status-badge ${village.isActive ? 'active' : 'inactive'}`}>
                    {village.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="row-actions">
                  <button onClick={() => handleEdit(village)} className="btn btn-ghost btn-sm">Edit</button>
                  <button onClick={() => handleDelete(village)} className="btn btn-ghost btn-sm delete-btn">Delete</button>
                </div>
              </div>
            ))}
          </div>
          {displayCount < filteredAndSortedVillages.length && (
            <div className="load-more-container">
              <button onClick={loadMore} className="btn btn-secondary">
                Load More ({filteredAndSortedVillages.length - displayCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      <Toast opened={showToast} text={toastMessage} onToastClosed={() => setShowToast(false)} />
    </div>
  );
};

export default VillageList;
