import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AppLayout from './components/Layout/AppLayout';
import SimpleDashboard from './components/Dashboard/SimpleDashboard';
import SimpleAddEntry from './components/AddEntry/SimpleAddEntry';
import SimpleAddAdvance from './components/AddAdvance/SimpleAddAdvance';
import SimpleReports from './components/Reports/SimpleReports';
import SimpleSettings from './components/Settings/SimpleSettings';
import SimpleSTRStatus from './components/STRStatus/SimpleSTRStatus';
import { ToastProvider } from './ui';

// Order matters. The legacy sheet loads first so the un-migrated screens keep
// their tokens, then ios26.css lands last and wins every shared declaration
// (body background, type ramp, colours). Reversing these two makes the new
// design system invisible.
import './App.css';
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
          </Routes>
        </AppLayout>
      </Router>
    </ToastProvider>
  );
}

export default App;
