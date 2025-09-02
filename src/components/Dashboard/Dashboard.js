import React, { useState, useEffect } from 'react';
import { 
  Block, 
  Card, 
  CardContent, 
  List, 
  ListItem, 
  Icon,
  Button,

} from 'framework7-react';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../../services/firebaseService';
import { format } from 'date-fns';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    todayTripsCount: 0,
    todayAdvancesTotal: 0,
    totalVehicles: 0,
    recentTrips: [],
    recentAdvances: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getTodayMetrics();
      console.log('Dashboard data loaded:', data);
      
      // Log recent trips to check vehicleType and strStatus
      if (data.recentTrips && data.recentTrips.length > 0) {
        console.log('Recent trips with new fields:');
        data.recentTrips.forEach((trip, index) => {
          console.log(`Trip ${index + 1}:`, {
            vehicleNumber: trip.vehicleNumber,
            vehicleType: trip.vehicleType,
            strStatus: trip.strStatus,
            villages: trip.villages
          });
        });
      }
      
      setMetrics(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };



  const formatTime = (date) => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'HH:mm');
  };

  if (loading) {
    return (
      <Block className="dashboard-container">
        <div className="loading-container">
          <div className="loading-shimmer" style={{ height: 100, marginBottom: 16 }}></div>
          <div className="loading-shimmer" style={{ height: 100, marginBottom: 16 }}></div>
          <div className="loading-shimmer" style={{ height: 200 }}></div>
        </div>
      </Block>
    );
  }

  return (
    <Block className="dashboard-container">
      {/* Welcome Section */}
      <Card className="welcome-card gradient-card">
        <CardContent>
          <div className="welcome-content">
            <h2>Welcome to SuhelRoadline</h2>
            <p>Travel ERP Management System</p>
            <div className="welcome-date">
              {format(new Date(), 'EEEE, MMMM dd, yyyy')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <Card className="metric-card fade-in">
          <CardContent>
            <div className="metric-item">
              <div className="metric-icon">
                <Icon ios="f7:car" size="24" />
              </div>
              <div className="metric-value">{metrics.todayTripsCount}</div>
              <div className="metric-label">Today's Trips</div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card fade-in">
          <CardContent>
            <div className="metric-item">
              <div className="metric-icon">
                <Icon ios="f7:money_dollar" size="24" />
              </div>
              <div className="metric-value">{formatCurrency(metrics.todayAdvancesTotal)}</div>
              <div className="metric-label">Today's Advances</div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card fade-in">
          <CardContent>
            <div className="metric-item">
              <div className="metric-icon">
                <Icon ios="f7:car_2" size="24" />
              </div>
              <div className="metric-value">{metrics.totalVehicles}</div>
              <div className="metric-label">Total Vehicles</div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card fade-in">
          <CardContent>
            <div className="metric-item">
              <div className="metric-icon">
                <Icon ios="f7:chart_bar" size="24" />
              </div>
              <div className="metric-value">
                {metrics.recentTrips.length + metrics.recentAdvances.length}
              </div>
              <div className="metric-label">Recent Activities</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="action-card">
        <CardContent>
          <h3>Quick Actions</h3>
          <div className="quick-actions-grid">
            <Button 
              className="quick-action-btn"
              onClick={() => navigate('/add-entry')}
            >
              <Icon ios="f7:plus_circle" size="28" />
              <span>Add Entry</span>
            </Button>
            
            <Button 
              className="quick-action-btn"
              onClick={() => navigate('/add-advance')}
            >
              <Icon ios="f7:money_dollar_circle" size="28" />
              <span>Add Advance</span>
            </Button>
            
            <Button 
              className="quick-action-btn"
              onClick={() => navigate('/reports')}
            >
              <Icon ios="f7:chart_bar" size="28" />
              <span>View Reports</span>
            </Button>
            
            <Button 
              className="quick-action-btn"
              onClick={() => navigate('/settings')}
            >
              <Icon ios="f7:gear" size="28" />
              <span>Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      {(metrics.recentTrips.length > 0 || metrics.recentAdvances.length > 0) && (
        <Card className="activity-card">
          <CardContent>
            <div className="activity-header">
              <h3>Recent Activities</h3>
              <Button 
                className="view-all-btn"
                onClick={() => navigate('/reports')}
              >
                View All
              </Button>
            </div>
            
            <List className="activity-list">
              {/* Recent Trips */}
              {metrics.recentTrips.slice(0, 3).map((trip) => (
                <ListItem key={`trip-${trip.id}`} className="activity-item">
                  <div slot="media" className="activity-icon trip-icon">
                    <Icon ios="f7:car" size="20" />
                  </div>
                  <div slot="title" className="activity-title">
                    Trip #{trip.slNumber} - {trip.vehicleNumber}
                  </div>
                  <div slot="subtitle" className="activity-subtitle">
                    {trip.villages?.join(', ') || 'No villages'} • Qty: {trip.quantity} •
                    Type: {trip.vehicleType || 'lorry'} • STR: {trip.strStatus || 'not received'}
                  </div>
                  <div slot="after" className="activity-time">
                    {formatTime(trip.createdAt)}
                  </div>
                </ListItem>
              ))}
              
              {/* Recent Advances */}
              {metrics.recentAdvances.slice(0, 3).map((advance) => (
                <ListItem key={`advance-${advance.id}`} className="activity-item">
                  <div slot="media" className="activity-icon advance-icon">
                    <Icon ios="f7:money_dollar" size="20" />
                  </div>
                  <div slot="title" className="activity-title">
                    Advance - {advance.vehicleNumber}
                  </div>
                  <div slot="subtitle" className="activity-subtitle">
                    {formatCurrency(advance.advanceAmount)} • {advance.note || 'No note'}
                  </div>
                  <div slot="after" className="activity-time">
                    {formatTime(advance.createdAt)}
                  </div>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {metrics.recentTrips.length === 0 && metrics.recentAdvances.length === 0 && (
        <Card className="empty-state-card">
          <CardContent>
            <div className="empty-state">
              <Icon ios="f7:tray" size="48" />
              <h3>No Activities Yet</h3>
              <p>Start by adding your first trip entry or advance payment</p>
              <Button 
                className="btn-primary"
                onClick={() => navigate('/add-entry')}
              >
                Add First Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </Block>
  );
};

export default Dashboard;
