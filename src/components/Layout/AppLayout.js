import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './AppLayout.css';

const AppLayout = ({ children }) => {
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

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">{getPageTitle()}</h1>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="app-nav">
        <button
          onClick={() => handleNavigation('/')}
          className={`nav-item ${isActive('/') ? 'nav-item-active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9,22 9,12 15,12 15,22"></polyline>
          </svg>
          <span>Home</span>
        </button>

        <button
          onClick={() => handleNavigation('/add-entry')}
          className={`nav-item ${isActive('/add-entry') ? 'nav-item-active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span>Add Entry</span>
        </button>

        <button
          onClick={() => handleNavigation('/add-advance')}
          className={`nav-item ${isActive('/add-advance') ? 'nav-item-active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span>Advance</span>
        </button>

        <button
          onClick={() => handleNavigation('/reports')}
          className={`nav-item ${isActive('/reports') ? 'nav-item-active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Reports</span>
        </button>

        <button
          onClick={() => handleNavigation('/settings')}
          className={`nav-item ${isActive('/settings') ? 'nav-item-active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default AppLayout;
