import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../../services/firebaseService';
import { format } from 'date-fns';
import './Dashboard.css';

const SimpleDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    todayTripsCount: 0,
    todayAdvancesTotal: 0,
    totalVehicles: 0,
    recentTrips: [],
    recentAdvances: []
  });
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      if (initialLoad) {
        setLoading(true);
        setInitialLoad(false);
      }
      
      // Load data with timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const dataPromise = dashboardService.getTodayMetrics();
      
      try {
        const data = await Promise.race([dataPromise, timeoutPromise]);
        setMetrics(data);
      } catch (timeoutError) {
        console.warn('Dashboard data loading timeout, using default values');
        // Set default values if Firebase is slow/unavailable
        setMetrics({
          todayTripsCount: 0,
          todayAdvancesTotal: 0,
          totalVehicles: 0,
          recentTrips: [],
          recentAdvances: []
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set default values on error
      setMetrics({
        todayTripsCount: 0,
        todayAdvancesTotal: 0,
        totalVehicles: 0,
        recentTrips: [],
        recentAdvances: []
      });
    } finally {
      setLoading(false);
    }
  }, [initialLoad]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // const formatTime = (date) => {
  //   if (!date) return '';
  //   const dateObj = date.toDate ? date.toDate() : new Date(date);
  //   return format(dateObj, 'HH:mm');
  // };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-shimmer" style={{ height: 100, marginBottom: 16 }}></div>
          <div className="loading-shimmer" style={{ height: 100, marginBottom: 16 }}></div>
          <div className="loading-shimmer" style={{ height: 200 }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Welcome Section */}
      <div className="welcome-card gradient-card">
        <div className="welcome-content">
          <h2>Welcome to SuhelRoadline</h2>
          <p>Travel ERP Management System</p>
          <div className="welcome-date">
            {format(new Date(), 'EEEE, MMMM dd, yyyy')}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card fade-in">
          <div className="metric-item">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
                <path d="M9 17v-6h4v6"></path>
              </svg>
            </div>
            <div className="metric-value">{metrics.todayTripsCount}</div>
            <div className="metric-label">Today's Trips</div>
          </div>
        </div>

        <div className="metric-card fade-in">
          <div className="metric-item">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div className="metric-value">{formatCurrency(metrics.todayAdvancesTotal)}</div>
            <div className="metric-label">Today's Advances</div>
          </div>
        </div>

        <div className="metric-card fade-in">
          <div className="metric-item">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M5 17h-2v-4m-1 -8h11a2 2 0 0 1 2 2v8"></path>
              </svg>
            </div>
            <div className="metric-value">{metrics.totalVehicles}</div>
            <div className="metric-label">Total Vehicles</div>
          </div>
        </div>

        <div className="metric-card fade-in">
          <div className="metric-item">
            <div className="metric-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div className="metric-value">
              {metrics.recentTrips.length + metrics.recentAdvances.length}
            </div>
            <div className="metric-label">Recent Activities</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="action-card">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button 
            className="quick-action-btn"
            onClick={() => navigate('/add-entry')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span>Add Entry</span>
          </button>
          
          <button 
            className="quick-action-btn"
            onClick={() => navigate('/add-advance')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span>Add Advance</span>
          </button>
          
          <button 
            className="quick-action-btn"
            onClick={() => navigate('/reports')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>View Reports</span>
          </button>
          
          <button 
            className="quick-action-btn"
            onClick={() => navigate('/settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {metrics.recentTrips.length === 0 && metrics.recentAdvances.length === 0 && (
        <div className="empty-state-card">
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
              <line x1="8" y1="1" x2="8" y2="4"></line>
              <line x1="16" y1="1" x2="16" y2="4"></line>
            </svg>
            <h3>No Activities Yet</h3>
            <p>Start by adding your first trip entry or advance payment</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/add-entry')}
            >
              Add First Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleDashboard;
