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
import DataPage from './components/Settings/DataPage';
import SimpleSTRStatus from './components/STRStatus/SimpleSTRStatus';
import PWABridge from './components/Common/PWABridge';
import { ToastProvider } from './ui';

// Single token layer. The legacy sheet that used to load ahead of this one is
// gone: Reports was the last screen on it, and its globals (border-box, heading
// margin reset) moved to index.css.
import './styles/ios26.css';

function App() {
  return (
    <ToastProvider>
      {/* Standalone-mode behaviour: display-mode + connectivity classes, outbox
          retry on reconnect/resume, and the service worker update prompt. Inside
          ToastProvider because it needs to talk to the user; outside Router
          because none of it is per-route. Renders nothing. */}
      <PWABridge />
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
            <Route path="/settings/data" element={<DataPage />} />
          </Routes>
        </AppLayout>
      </Router>
    </ToastProvider>
  );
}

export default App;
