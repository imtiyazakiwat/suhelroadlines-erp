import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SimpleLayout.css';

const SimpleLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/add-entry':
        return 'Add Entry';
      case '/add-advance':
        return 'Add Advance';
      case '/reports':
        return 'Reports';
      case '/settings':
        return 'Settings';
      default:
        return 'SuhelRoadline';
    }
  };

  const isActive = (path) => location.pathname === path;

  const handleNavClick = (path) => {
    navigate(path);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">{getPageTitle()}</h1>
      </header>
      
      {/* Main Content */}
      <main className="app-content">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${isActive('/') ? 'active' : ''}`}
          onClick={() => handleNavClick('/')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9,22 9,12 15,12 15,22"></polyline>
          </svg>
          <span className="nav-label">Home</span>
        </button>
        
        <button 
          className={`nav-item ${isActive('/add-entry') ? 'active' : ''}`}
          onClick={() => handleNavClick('/add-entry')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span className="nav-label">Add Entry</span>
        </button>
        
        <button 
          className={`nav-item ${isActive('/add-advance') ? 'active' : ''}`}
          onClick={() => handleNavClick('/add-advance')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span className="nav-label">Advance</span>
        </button>
        
        <button 
          className={`nav-item ${isActive('/reports') ? 'active' : ''}`}
          onClick={() => handleNavClick('/reports')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span className="nav-label">Reports</span>
        </button>
        
        <button 
          className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          onClick={() => handleNavClick('/settings')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span className="nav-label">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default SimpleLayout;
