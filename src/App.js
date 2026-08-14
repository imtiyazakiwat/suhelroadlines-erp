import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AppLayout from './components/Layout/AppLayout';
import SimpleDashboard from './components/Dashboard/SimpleDashboard';
import SimpleAddEntry from './components/AddEntry/SimpleAddEntry';
import SimpleAddAdvance from './components/AddAdvance/SimpleAddAdvance';
import SimpleReports from './components/Reports/SimpleReports';
import SimpleSettings from './components/Settings/SimpleSettings';
import VehiclesPage from './components/Settings/VehiclesPage';
import VillagesPage from './components/Settings/VillagesPage';
import SimpleSTRStatus from './components/STRStatus/SimpleSTRStatus';
import { ToastProvider } from './ui';

// Single token layer. The legacy sheet that used to load ahead of this one is
// gone: Reports was the last screen on it, and its globals (border-box, heading
// margin reset) moved to index.css.
import './styles/ios26.css';

function App() {
  return (
    <ToastProvider>
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<SimpleDashboard />} />
            <Route path="/add-entry" element={<SimpleAddEntry />} />
            <Route path="/add-advance" element={<SimpleAddAdvance />} />
            <Route path="/reports" element={<SimpleReports />} />
            <Route path="/str-status" element={<SimpleSTRStatus />} />
            <Route path="/settings" element={<SimpleSettings />} />
            {/* Pushed from Settings, so they get a Back button and real deep links
                instead of a sheet opened from inside another sheet. */}
            <Route path="/settings/vehicles" element={<VehiclesPage />} />
            <Route path="/settings/villages" element={<VillagesPage />} />
          </Routes>
        </AppLayout>
      </Router>
    </ToastProvider>
  );
}

export default App;
