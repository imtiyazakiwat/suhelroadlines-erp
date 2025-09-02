import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import Framework7 layout and components
import AppLayout from './components/Layout/AppLayout';
import SimpleDashboard from './components/Dashboard/SimpleDashboard';
import SimpleAddEntry from './components/AddEntry/SimpleAddEntry';
import SimpleAddAdvance from './components/AddAdvance/SimpleAddAdvance';
import SimpleReports from './components/Reports/SimpleReports';
import SimpleSettings from './components/Settings/SimpleSettings';
import SimpleSTRStatus from './components/STRStatus/SimpleSTRStatus';

// Import custom styles
import './App.css';

function App() {
  return (
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
  );
}

export default App;